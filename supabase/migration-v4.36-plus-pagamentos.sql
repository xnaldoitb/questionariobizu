-- ============================================================
-- QUESTIONÁRIO BIZU v4.36
-- Plano atual, insígnia Plus e limpeza segura de cobranças
-- ============================================================

begin;

alter table public.usuarios
    add column if not exists plano_atual text;

alter table public.pagamentos
    add column if not exists excluido_em timestamptz,
    add column if not exists excluido_por_admin_id uuid references public.usuarios(id) on delete set null;

create index if not exists pagamentos_visiveis_criado_idx
    on public.pagamentos(criado_em desc) where excluido_em is null;

comment on column public.usuarios.plano_atual is
    'Último plano aplicado ao acesso atual. Trimestral exibe Plus; mensal exibe Premium; permanente exibe VIP.';

-- Recupera o plano mais recente já aplicado, sem alterar validade ou acesso.
with ultimo_plano as (
    select distinct on (p.usuario_id)
        p.usuario_id,
        p.plano
    from public.pagamentos p
    where p.status = 'approved'
      and p.aplicado_em is not null
    order by p.usuario_id, p.aplicado_em desc, p.criado_em desc
)
update public.usuarios u
   set plano_atual = up.plano
  from ultimo_plano up
 where u.id = up.usuario_id
   and (u.vip = true or u.validade_ate > now());

update public.usuarios
   set plano_atual = 'vitalicio'
 where vip = true;

-- Mantém a proteção de compensação da v4.20 e passa a registrar o plano aplicado.
create or replace function public.confirmar_pagamento_pix(
    p_pagamento_id uuid, p_mercado_pago_payment_id text, p_status text,
    p_valor_recebido numeric, p_moeda text, p_meio_pagamento text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_pagamento public.pagamentos%rowtype;
    v_manual public.pagamentos%rowtype;
    v_validade timestamptz;
begin
    select * into v_pagamento from public.pagamentos where id = p_pagamento_id for update;
    if not found then return jsonb_build_object('aplicado',false,'motivo','pagamento_nao_encontrado'); end if;
    if v_pagamento.origem is distinct from 'mercado_pago' then
        return jsonb_build_object('aplicado',false,'motivo','origem_invalida');
    end if;
    if v_pagamento.aplicado_em is not null then
        return jsonb_build_object('aplicado',false,'motivo','ja_aplicado');
    end if;
    if p_mercado_pago_payment_id is null or p_mercado_pago_payment_id !~ '^[0-9]+$'
       or (v_pagamento.mp_payment_id_informado is not null
           and v_pagamento.mp_payment_id_informado <> p_mercado_pago_payment_id) then
        return jsonb_build_object('aplicado',false,'motivo','id_divergente');
    end if;
    if p_status is distinct from 'approved' then
        update public.pagamentos set status = left(coalesce(p_status,'desconhecido'),40),
            mercado_pago_payment_id = p_mercado_pago_payment_id, atualizado_em = now()
        where id = p_pagamento_id;
        return jsonb_build_object('aplicado',false,'motivo','nao_aprovado');
    end if;
    if p_moeda is distinct from 'BRL' or p_meio_pagamento is null
       or p_meio_pagamento not in ('pix','account_money')
       or p_valor_recebido is distinct from v_pagamento.valor then
        update public.pagamentos set status='revisao', atualizado_em=now() where id=p_pagamento_id;
        return jsonb_build_object('aplicado',false,'motivo','dados_divergentes');
    end if;
    if v_pagamento.compensacao_manual_id is not null then
        select * into v_manual from public.pagamentos where id=v_pagamento.compensacao_manual_id for update;
        if not found then raise exception 'Liberação manual não encontrada.'; end if;
        if v_manual.origem is distinct from 'manual' or v_manual.status is distinct from 'approved'
           or v_manual.aplicado_em is null or v_manual.usuario_id is distinct from v_pagamento.usuario_id
           or v_manual.plano is distinct from v_pagamento.plano
           or v_manual.duracao_dias is distinct from v_pagamento.duracao_dias
           or v_manual.acesso_permanente is distinct from v_pagamento.acesso_permanente then
            raise exception 'Liberação manual incompatível com a cobrança.';
        end if;
        select validade_ate into v_validade from public.usuarios where id=v_pagamento.usuario_id;
    else
        v_validade := public.aplicar_periodo_acesso(
            v_pagamento.usuario_id,
            v_pagamento.duracao_dias,
            v_pagamento.acesso_permanente
        );
    end if;

    update public.usuarios
       set plano_atual = v_pagamento.plano
     where id = v_pagamento.usuario_id;

    update public.pagamentos set status='approved', mercado_pago_payment_id=p_mercado_pago_payment_id,
        atualizado_em=now(), aprovado_em=now(), aplicado_em=coalesce(v_manual.aplicado_em,now()),
        excluido_em=null, excluido_por_admin_id=null
    where id=p_pagamento_id;
    return jsonb_build_object('aplicado',true,'compensado_manualmente',v_pagamento.compensacao_manual_id is not null,
        'plano',v_pagamento.plano,'validade_ate',v_validade,'meio_pagamento',p_meio_pagamento);
end;
$$;

create or replace function public.conceder_acesso_plano(
    p_usuario_id uuid,
    p_plano_id text,
    p_admin_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
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
           responsavel_admin_id = coalesce(responsavel_admin_id, p_admin_id),
           plano_atual = v_plano.id
     where id = p_usuario_id;

    insert into public.pagamentos (
        id, usuario_id, plano, plano_nome, valor, duracao_dias, acesso_permanente,
        status, origem, criado_por_admin_id, aprovado_em, aplicado_em
    ) values (
        v_pagamento_id, p_usuario_id, v_plano.id, v_plano.nome, 0,
        v_plano.duracao_dias, v_plano.acesso_permanente,
        'approved', 'manual', p_admin_id, now(), now()
    );

    return jsonb_build_object('ok', true, 'pagamento_id', v_pagamento_id,
        'plano', v_plano.id, 'validade_ate', v_validade);
end;
$$;

drop view if exists public.ranking_usuarios;
create view public.ranking_usuarios as
select
  u.id as usuario_id,
  u.nome,
  u.usuario,
  u.perfil,
  u.vip,
  count(distinct r.sessao_id)::bigint as sessoes,
  count(r.id)::bigint as respondidas,
  count(r.id) filter (where r.acertou)::bigint as acertos,
  case when count(r.id) > 0
    then round((count(r.id) filter (where r.acertou))::numeric / count(r.id)::numeric * 100)::integer
    else 0 end as percentual,
  u.premium,
  u.plano_atual
from public.usuarios u
join public.respostas r on r.usuario_id = u.id
where r.pulada = false and r.resposta_marcada is not null
group by u.id, u.nome, u.usuario, u.perfil, u.vip, u.premium, u.plano_atual;

revoke all on public.ranking_usuarios from public, anon, authenticated;
grant select on public.ranking_usuarios to service_role;
grant select, insert, update on public.pagamentos to service_role;

revoke all on function public.confirmar_pagamento_pix(uuid,text,text,numeric,text,text)
    from public, anon, authenticated;
revoke all on function public.conceder_acesso_plano(uuid,text,uuid)
    from public, anon, authenticated;
grant execute on function public.confirmar_pagamento_pix(uuid,text,text,numeric,text,text)
    to service_role;
grant execute on function public.conceder_acesso_plano(uuid,text,uuid)
    to service_role;

commit;
