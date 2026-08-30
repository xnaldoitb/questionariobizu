-- Questionário Bizu v4.4
-- Expõe o perfil no ranking somente para renderização das insígnias visuais.
-- Não altera privilégios, validade, VIP, histórico ou pontuação.

begin;

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
    case
        when count(r.id) > 0 then
            round((count(r.id) filter (where r.acertou))::numeric / count(r.id)::numeric * 100)::integer
        else 0
    end as percentual
from public.usuarios u
join public.respostas r on r.usuario_id = u.id
where r.pulada = false
  and r.resposta_marcada is not null
group by u.id, u.nome, u.usuario, u.perfil, u.vip;

comment on view public.ranking_usuarios is
'Ranking imediato do Questionário Bizu. O campo perfil é exposto somente para identificação visual das insígnias de Aluno/Premium, ADM e Desenvolvedor.';

revoke all on public.ranking_usuarios from anon, authenticated;
grant select on public.ranking_usuarios to service_role;

commit;
