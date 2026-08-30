-- ============================================================
-- QUESTIONARIO BIZU v4.10
-- Premium para planos com prazo e VIP para acesso permanente
-- ============================================================

alter table public.usuarios
    add column if not exists premium boolean not null default false;

-- Reconhece acessos pagos com prazo que ainda estão ativos.
update public.usuarios
   set premium = true
 where perfil = 'aluno'
   and vip = false
   and acesso_teste = false
   and status_aprovacao = 'aprovado'
   and validade_ate is not null
   and validade_ate > now();

update public.usuarios set premium = false where vip = true;

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
           set vip = true, premium = false, vip_desde = coalesce(vip_desde, now()),
               acesso_teste = false, teste_expira_em = null, validade_ate = null,
               status_aprovacao = 'aprovado', ativo = true, desativado_por_validade = false
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
       set vip = false, premium = true, vip_desde = null, acesso_teste = false,
           teste_expira_em = null, validade_ate = v_validade,
           status_aprovacao = 'aprovado', ativo = true, desativado_por_validade = false
     where id = p_usuario_id;
    return v_validade;
end;
$$;

create or replace view public.ranking_usuarios as
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
  u.premium
from public.usuarios u
join public.respostas r on r.usuario_id = u.id
where r.pulada = false and r.resposta_marcada is not null
group by u.id, u.nome, u.usuario, u.perfil, u.vip, u.premium;

revoke all on public.ranking_usuarios from anon, authenticated;
grant select on public.ranking_usuarios to service_role;
revoke all on function public.aplicar_periodo_acesso(uuid, integer, boolean) from public;
grant execute on function public.aplicar_periodo_acesso(uuid, integer, boolean) to service_role;

comment on column public.usuarios.premium is
    'Insígnia ativa para acesso pago com prazo. É removida ao vencer ou ao tornar-se VIP.';
