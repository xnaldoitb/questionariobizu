-- Otimizações do Questionário Bizu
-- Execute uma única vez no SQL Editor do Supabase do projeto correto.

-- Histórico do usuário: filtros e ordenação por data.
create index if not exists idx_respostas_usuario_historico
on public.respostas (usuario_id, pulada, acertou, respondida_em desc);

-- Respostas por sessão: acelera exclusões, revisões e integridade relacional.
create index if not exists idx_respostas_sessao
on public.respostas (sessao_id);

-- Última resposta por questão: usado no modo "não respondidas + erradas".
create index if not exists idx_respostas_usuario_questao_recente
on public.respostas (usuario_id, questao_id, respondida_em desc)
where pulada = false;

-- Questões por disciplina/capítulo, inclusive quando o aluno escolhe "Todos os capítulos".
create index if not exists idx_questoes_disciplina_ativo_id
on public.questoes (disciplina_id, ativo, id);

create index if not exists idx_questoes_capitulo_ativo_id
on public.questoes (capitulo_id, ativo, id);

-- Ranking v4.3: cada resposta efetivamente marcada conta imediatamente,
-- mesmo que a sessão ainda não tenha sido finalizada.
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
'Ranking imediato do Questionário Bizu, agregado por respostas registradas, inclusive em simulados não finalizados.';

revoke all on public.ranking_usuarios from anon, authenticated;
grant select on public.ranking_usuarios to service_role;
