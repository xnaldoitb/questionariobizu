-- ============================================================
-- QUESTIONARIO BIZU v4.9
-- Planos administráveis, pagamentos e concessão manual
-- ============================================================

create table if not exists public.planos_acesso (
    id text primary key check (id ~ '^[a-z0-9_-]{3,40}$'),
    nome text not null,
    preco numeric(10,2) not null check (preco > 0),
    duracao_dias integer check (duracao_dias is null or duracao_dias > 0),
    acesso_permanente boolean not null default false,
    ativo boolean not null default true,
    ordem integer not null default 0,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    check ((acesso_permanente and duracao_dias is null) or (not acesso_permanente and duracao_dias is not null))
);

insert into public.planos_acesso (id, nome, preco, duracao_dias, acesso_permanente, ordem)
values
    ('mensal', 'Mensal', 20.00, 30, false, 10),
    ('trimestral', 'Trimestral', 50.00, 90, false, 20),
    ('vitalicio', 'Vitalício', 80.00, null, true, 30)
on conflict (id) do nothing;

alter table public.pagamentos
    add column if not exists plano_nome text,
    add column if not exists duracao_dias integer,
    add column if not exists acesso_permanente boolean not null default false,
    add column if not exists origem text not null default 'mercado_pago',
    add column if not exists criado_por_admin_id uuid references public.usuarios(id) on delete set null;

alter table public.pagamentos drop constraint if exists pagamentos_plano_check;
alter table public.pagamentos drop constraint if exists pagamentos_valor_check;
alter table public.pagamentos add constraint pagamentos_valor_check check (valor >= 0);

update public.pagamentos
set plano_nome = coalesce(plano_nome, case plano when 'mensal' then 'Mensal' when 'trimestral' then 'Trimestral' when 'vitalicio' then 'Vitalício' else plano end),
    duracao_dias = coalesce(duracao_dias, case plano when 'mensal' then 30 when 'trimestral' then 90 else null end),
    acesso_permanente = case when plano = 'vitalicio' then true else acesso_permanente end
where plano_nome is null or (duracao_dias is null and plano in ('mensal', 'trimestral'));

create index if not exists idx_usuarios_responsavel_admin_pagamentos on public.usuarios(responsavel_admin_id, criado_em desc);

alter table public.planos_acesso enable row level security;
revoke all on public.planos_acesso from anon, authenticated;
grant select, insert, update on public.planos_acesso to service_role;
grant select, insert, update on public.pagamentos to service_role;

create or replace function public.aplicar_periodo_acesso(
    p_usuario_id uuid,
    p_duracao_dias integer,
    p_acesso_permanente boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    v_base timestamptz;
    v_validade timestamptz;
begin
    if p_acesso_permanente then
        update public.usuarios
           set vip = true, vip_desde = coalesce(vip_desde, now()), acesso_teste = false,
               teste_expira_em = null, validade_ate = null, status_aprovacao = 'aprovado',
               ativo = true, desativado_por_validade = false
         where id = p_usuario_id;
        return null;
    end if;

    if p_duracao_dias is null or p_duracao_dias <= 0 then
        raise exception 'Duração de plano inválida.';
    end if;

    select greatest(now(), coalesce(validade_ate, now())) into v_base
      from public.usuarios where id = p_usuario_id for update;
    if not found then raise exception 'Usuário não encontrado.'; end if;

    v_validade := v_base + make_interval(days => p_duracao_dias);
    update public.usuarios
       set vip = false, vip_desde = null, acesso_teste = false, teste_expira_em = null,
           validade_ate = v_validade, status_aprovacao = 'aprovado', ativo = true,
           desativado_por_validade = false
     where id = p_usuario_id;
    return v_validade;
end;
$$;

create or replace function public.confirmar_pagamento_pix(
    p_pagamento_id uuid,
    p_mercado_pago_payment_id text,
    p_status text,
    p_valor_recebido numeric,
    p_moeda text,
    p_meio_pagamento text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pagamento public.pagamentos%rowtype;
    v_validade timestamptz;
begin
    select * into v_pagamento from public.pagamentos where id = p_pagamento_id for update;
    if not found then return jsonb_build_object('aplicado', false, 'motivo', 'pagamento_nao_encontrado'); end if;
    if v_pagamento.aplicado_em is not null then return jsonb_build_object('aplicado', false, 'motivo', 'ja_aplicado'); end if;

    if p_status <> 'approved' then
        update public.pagamentos set status = left(coalesce(p_status, 'desconhecido'), 40),
            mercado_pago_payment_id = coalesce(mercado_pago_payment_id, p_mercado_pago_payment_id), atualizado_em = now()
        where id = p_pagamento_id;
        return jsonb_build_object('aplicado', false, 'motivo', 'nao_aprovado');
    end if;

    if p_moeda <> 'BRL' or p_meio_pagamento <> 'pix' or p_valor_recebido <> v_pagamento.valor then
        update public.pagamentos set status = 'revisao', atualizado_em = now() where id = p_pagamento_id;
        return jsonb_build_object('aplicado', false, 'motivo', 'dados_divergentes');
    end if;

    v_validade := public.aplicar_periodo_acesso(v_pagamento.usuario_id, v_pagamento.duracao_dias, v_pagamento.acesso_permanente);
    update public.pagamentos set status = 'approved', mercado_pago_payment_id = p_mercado_pago_payment_id,
        atualizado_em = now(), aprovado_em = now(), aplicado_em = now() where id = p_pagamento_id;

    return jsonb_build_object('aplicado', true, 'plano', v_pagamento.plano, 'validade_ate', v_validade);
end;
$$;

create or replace function public.conceder_acesso_plano(
    p_usuario_id uuid,
    p_plano_id text,
    p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_plano public.planos_acesso%rowtype;
    v_validade timestamptz;
    v_pagamento_id uuid := gen_random_uuid();
begin
    select * into v_plano from public.planos_acesso where id = p_plano_id and ativo = true;
    if not found then raise exception 'Plano não encontrado ou inativo.'; end if;

    v_validade := public.aplicar_periodo_acesso(p_usuario_id, v_plano.duracao_dias, v_plano.acesso_permanente);
    update public.usuarios
       set aprovado_por_admin_id = coalesce(aprovado_por_admin_id, p_admin_id),
           responsavel_admin_id = coalesce(responsavel_admin_id, p_admin_id)
     where id = p_usuario_id;

    insert into public.pagamentos (
        id, usuario_id, plano, plano_nome, valor, duracao_dias, acesso_permanente,
        status, origem, criado_por_admin_id, aprovado_em, aplicado_em
    ) values (
        v_pagamento_id, p_usuario_id, v_plano.id, v_plano.nome, 0,
        v_plano.duracao_dias, v_plano.acesso_permanente,
        'approved', 'manual', p_admin_id, now(), now()
    );

    return jsonb_build_object('ok', true, 'pagamento_id', v_pagamento_id, 'validade_ate', v_validade);
end;
$$;

revoke all on function public.aplicar_periodo_acesso(uuid, integer, boolean) from public;
revoke all on function public.confirmar_pagamento_pix(uuid, text, text, numeric, text, text) from public;
revoke all on function public.conceder_acesso_plano(uuid, text, uuid) from public;
grant execute on function public.aplicar_periodo_acesso(uuid, integer, boolean) to service_role;
grant execute on function public.confirmar_pagamento_pix(uuid, text, text, numeric, text, text) to service_role;
grant execute on function public.conceder_acesso_plano(uuid, text, uuid) to service_role;
