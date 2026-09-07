-- Questionário Bizu v4.42: inclui todos os cadastros no ranking, mesmo sem respostas.
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
left join public.respostas r
  on r.usuario_id = u.id
 and r.pulada = false
 and r.resposta_marcada is not null
group by u.id, u.nome, u.usuario, u.perfil, u.vip, u.premium, u.plano_atual;

comment on view public.ranking_usuarios is
  'Ranking de todos os cadastros, inclusive pendentes, inativos e ainda sem respostas.';

revoke all on public.ranking_usuarios from public, anon, authenticated;
grant select on public.ranking_usuarios to service_role;
