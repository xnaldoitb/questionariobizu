-- ============================================================
-- QUESTIONARIO BIZU v4.8
-- WhatsApp no cadastro + pagamentos Pix automáticos
-- ============================================================

alter table public.usuarios
    add column if not exists whatsapp text;

alter table public.usuarios
    drop constraint if exists usuarios_whatsapp_formato;

alter table public.usuarios
    add constraint usuarios_whatsapp_formato
    check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$');

create table if not exists public.pagamentos (
    id uuid primary key,
    usuario_id uuid not null references public.usuarios(id) on delete cascade,
    plano text not null check (plano in ('mensal', 'trimestral', 'vitalicio')),
    valor numeric(10,2) not null check (valor > 0),
    status text not null default 'pendente',
    mercado_pago_preference_id text unique,
    mercado_pago_payment_id text unique,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    aprovado_em timestamptz,
    aplicado_em timestamptz
);

create index if not exists idx_pagamentos_usuario_criado
    on public.pagamentos (usuario_id, criado_em desc);
create index if not exists idx_pagamentos_status
    on public.pagamentos (status, atualizado_em desc);

alter table public.pagamentos enable row level security;
revoke all on public.pagamentos from anon, authenticated;
grant select, insert, update on public.pagamentos to service_role;

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
    v_base timestamptz;
    v_nova_validade timestamptz;
begin
    select * into v_pagamento
      from public.pagamentos
     where id = p_pagamento_id
     for update;

    if not found then
        return jsonb_build_object('aplicado', false, 'motivo', 'pagamento_nao_encontrado');
    end if;

    if v_pagamento.aplicado_em is not null then
        return jsonb_build_object('aplicado', false, 'motivo', 'ja_aplicado');
    end if;

    if p_status <> 'approved' then
        update public.pagamentos
           set status = left(coalesce(p_status, 'desconhecido'), 40),
               mercado_pago_payment_id = coalesce(mercado_pago_payment_id, p_mercado_pago_payment_id),
               atualizado_em = now()
         where id = p_pagamento_id;
        return jsonb_build_object('aplicado', false, 'motivo', 'nao_aprovado');
    end if;

    if p_moeda <> 'BRL'
       or p_meio_pagamento <> 'pix'
       or p_valor_recebido <> v_pagamento.valor then
        update public.pagamentos
           set status = 'revisao', atualizado_em = now()
         where id = p_pagamento_id;
        return jsonb_build_object('aplicado', false, 'motivo', 'dados_divergentes');
    end if;

    if v_pagamento.plano = 'vitalicio' then
        update public.usuarios
           set vip = true,
               vip_desde = coalesce(vip_desde, now()),
               acesso_teste = false,
               teste_expira_em = null,
               validade_ate = null,
               status_aprovacao = 'aprovado',
               ativo = true,
               desativado_por_validade = false
         where id = v_pagamento.usuario_id;
        v_nova_validade := null;
    else
        select greatest(now(), coalesce(validade_ate, now()))
          into v_base
          from public.usuarios
         where id = v_pagamento.usuario_id
         for update;

        v_nova_validade := v_base + case v_pagamento.plano
            when 'mensal' then interval '30 days'
            when 'trimestral' then interval '90 days'
        end;

        update public.usuarios
           set vip = false,
               acesso_teste = false,
               teste_expira_em = null,
               validade_ate = v_nova_validade,
               status_aprovacao = 'aprovado',
               ativo = true,
               desativado_por_validade = false
         where id = v_pagamento.usuario_id;
    end if;

    update public.pagamentos
       set status = 'approved',
           mercado_pago_payment_id = p_mercado_pago_payment_id,
           atualizado_em = now(),
           aprovado_em = now(),
           aplicado_em = now()
     where id = p_pagamento_id;

    return jsonb_build_object(
        'aplicado', true,
        'plano', v_pagamento.plano,
        'validade_ate', v_nova_validade
    );
end;
$$;

revoke all on function public.confirmar_pagamento_pix(uuid, text, text, numeric, text, text) from public;
grant execute on function public.confirmar_pagamento_pix(uuid, text, text, numeric, text, text) to service_role;

comment on column public.usuarios.whatsapp is
    'Telefone do WhatsApp com código do país e DDD, apenas dígitos.';
comment on table public.pagamentos is
    'Cobranças Pix do Mercado Pago e controle idempotente da liberação de acesso.';
