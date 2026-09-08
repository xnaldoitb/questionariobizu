-- Questionário Bizu v4.46.1 · retroativo completo das missões atuais.
-- Execute uma única vez no SQL Editor do Supabase após a migração v4.44.1.
-- O script é idempotente: pode ser executado novamente sem duplicar XP.

begin;

create temporary table tmp_respostas_missoes on commit drop as
select
  r.id,
  r.usuario_id,
  r.respondida_em,
  (r.respondida_em at time zone 'America/Belem')::date as dia,
  r.acertou,
  coalesce(r.disciplina_id_snapshot, q.disciplina_id) as disciplina_id,
  coalesce(r.capitulo_id_snapshot, q.capitulo_id) as capitulo_id
from public.respostas r
left join public.questoes q on q.id = r.questao_id
where r.pulada = false
  and r.resposta_marcada is not null;

create index on tmp_respostas_missoes(usuario_id, dia, respondida_em, id);

create temporary table tmp_missoes_retro_candidatas (
  usuario_id uuid not null,
  chave text not null,
  pontos integer not null check (pontos > 0),
  detalhes jsonb not null default '{}'::jsonb,
  primary key (usuario_id, chave)
) on commit drop;

-- Sequência certeira: maior sequência alcançada em cada dia. Respostas
-- erradas quebram a série; respostas puladas não fazem parte da contagem.
with ordenadas as (
  select r.*,
    sum(case when r.acertou then 0 else 1 end) over (
      partition by r.usuario_id, r.dia order by r.respondida_em, r.id
      rows between unbounded preceding and current row
    ) as grupo_erro
  from tmp_respostas_missoes r
), series as (
  select usuario_id, dia, grupo_erro, count(*)::integer as tamanho
  from ordenadas where acertou
  group by usuario_id, dia, grupo_erro
), maximas as (
  select usuario_id, dia, max(tamanho)::integer as maior_sequencia
  from series group by usuario_id, dia
)
insert into tmp_missoes_retro_candidatas(usuario_id, chave, pontos, detalhes)
select m.usuario_id,
  format('missao:sequencia:%s:%s', m.dia, etapa * 10),
  etapa * 25,
  jsonb_build_object('retroativo', true, 'missao', 'sequencia-progressiva',
    'dia', m.dia, 'meta', etapa * 10, 'maior_sequencia', m.maior_sequencia)
from maximas m
cross join lateral generate_series(1, floor(m.maior_sequencia / 10.0)::integer) etapa
on conflict do nothing;

-- Ronda de disciplinas: etapas de 3 a 18 disciplinas distintas por dia.
with totais as (
  select usuario_id, dia, count(distinct disciplina_id)::integer as disciplinas
  from tmp_respostas_missoes
  where disciplina_id is not null
  group by usuario_id, dia
)
insert into tmp_missoes_retro_candidatas(usuario_id, chave, pontos, detalhes)
select t.usuario_id,
  format('missao:ronda:%s:%s', t.dia, etapa * 3),
  etapa * 40,
  jsonb_build_object('retroativo', true, 'missao', 'ronda-progressiva',
    'dia', t.dia, 'meta', etapa * 3, 'disciplinas', t.disciplinas)
from totais t
cross join lateral generate_series(1, least(6, floor(t.disciplinas / 3.0)::integer)) etapa
on conflict do nothing;

-- Ritmo diário: etapas ilimitadas a cada 20 respostas válidas, valendo o
-- triplo da meta (20 questões = 60 XP, 40 = 120 XP e assim por diante).
with totais as (
  select usuario_id, dia, count(*)::integer as respostas_validas
  from tmp_respostas_missoes
  group by usuario_id, dia
)
insert into tmp_missoes_retro_candidatas(usuario_id, chave, pontos, detalhes)
select t.usuario_id,
  format('missao:ritmo-%s:%s', etapa * 20, t.dia),
  etapa * 60,
  jsonb_build_object('retroativo', true, 'missao', 'ritmo-progressivo',
    'dia', t.dia, 'meta', etapa * 20, 'respostas_validas', t.respostas_validas)
from totais t
cross join lateral generate_series(1, floor(t.respostas_validas / 20.0)::integer) etapa
on conflict do nothing;

-- Precisão e Excelência são verificadas em cada ponto do dia. Assim, uma
-- missão já alcançada não é perdida se respostas posteriores reduzirem a taxa.
with progresso as (
  select r.usuario_id, r.dia,
    (row_number() over (
      partition by r.usuario_id, r.dia order by r.respondida_em, r.id
    ))::integer as respondidas,
    (sum(case when r.acertou then 1 else 0 end) over (
      partition by r.usuario_id, r.dia order by r.respondida_em, r.id
      rows between unbounded preceding and current row
    ))::integer as acertos
  from tmp_respostas_missoes r
), concluidas as (
  select usuario_id, dia,
    bool_or(respondidas >= 10 and acertos * 100 >= respondidas * 80) as precisao,
    bool_or(respondidas >= 20 and acertos * 100 >= respondidas * 90) as excelencia
  from progresso group by usuario_id, dia
)
insert into tmp_missoes_retro_candidatas(usuario_id, chave, pontos, detalhes)
select usuario_id, format('missao:precisao-80:%s', dia), 30,
  jsonb_build_object('retroativo', true, 'missao', 'precisao-diaria', 'dia', dia)
from concluidas where precisao
union all
select usuario_id, format('missao:excelencia-90:%s', dia), 60,
  jsonb_build_object('retroativo', true, 'missao', 'excelencia-diaria', 'dia', dia)
from concluidas where excelencia
on conflict do nothing;

-- Constância semanal: uma recompensa para cada período contínuo que tenha
-- alcançado pelo menos sete dias de estudo.
with dias as (
  select distinct usuario_id, dia from tmp_respostas_missoes
), ilhas as (
  select usuario_id, dia,
    dia - (row_number() over (partition by usuario_id order by dia)::integer) as grupo
  from dias
), periodos as (
  select usuario_id, min(dia) as inicio, count(*)::integer as dias_seguidos
  from ilhas group by usuario_id, grupo
  having count(*) >= 7
)
insert into tmp_missoes_retro_candidatas(usuario_id, chave, pontos, detalhes)
select usuario_id, format('missao:constancia-7:%s', inicio), 200,
  jsonb_build_object('retroativo', true, 'missao', 'constancia-7',
    'inicio', inicio, 'dias_seguidos', dias_seguidos)
from periodos
on conflict do nothing;

-- Metas semanais, considerando segunda-feira como início da semana.
with semanais as (
  select usuario_id,
    (dia - (extract(isodow from dia)::integer - 1))::date as semana,
    count(*)::integer as respostas_validas,
    count(distinct capitulo_id)::integer as capitulos
  from tmp_respostas_missoes
  group by usuario_id, (dia - (extract(isodow from dia)::integer - 1))::date
)
insert into tmp_missoes_retro_candidatas(usuario_id, chave, pontos, detalhes)
select usuario_id, format('missao:centena-100:%s', semana), 150,
  jsonb_build_object('retroativo', true, 'missao', 'centena-semanal',
    'semana', semana, 'respostas_validas', respostas_validas)
from semanais where respostas_validas >= 100
union all
select usuario_id, format('missao:explorador-5:%s', semana), 100,
  jsonb_build_object('retroativo', true, 'missao', 'explorador-semanal',
    'semana', semana, 'capitulos', capitulos)
from semanais where capitulos >= 5
on conflict do nothing;

-- Corrige eventos progressivos concedidos por versões anteriores com valor
-- fixo. Apenas diferenças positivas são creditadas; XP nunca é reduzido.
create temporary table tmp_missoes_retro_correcoes on commit drop as
with esperados as (
  select id, usuario_id, pontos,
    (substring(chave from '^missao:sequencia:[0-9]{4}-[0-9]{2}-[0-9]{2}:([0-9]+)$')::integer / 10) * 25 as esperado
  from public.xp_eventos
  where chave ~ '^missao:sequencia:[0-9]{4}-[0-9]{2}-[0-9]{2}:[0-9]+$'
  union all
  select id, usuario_id, pontos,
    (substring(chave from '^missao:ronda:[0-9]{4}-[0-9]{2}-[0-9]{2}:([0-9]+)$')::integer / 3) * 40 as esperado
  from public.xp_eventos
  where chave ~ '^missao:ronda:[0-9]{4}-[0-9]{2}-[0-9]{2}:[0-9]+$'
  union all
  select id, usuario_id, pontos,
    (substring(chave from '^missao:ritmo-([0-9]+):[0-9]{4}-[0-9]{2}-[0-9]{2}$')::integer / 20) * 60 as esperado
  from public.xp_eventos
  where chave ~ '^missao:ritmo-[0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
)
select id, usuario_id, esperado, (esperado - pontos)::bigint as diferenca
from esperados
where esperado > pontos;

update public.xp_eventos e
set pontos = c.esperado,
    detalhes = e.detalhes || jsonb_build_object('recompensa_progressiva_corrigida', true)
from tmp_missoes_retro_correcoes c
where e.id = c.id;

create temporary table tmp_missoes_retro_creditos (
  usuario_id uuid not null,
  pontos bigint not null
) on commit drop;

insert into tmp_missoes_retro_creditos(usuario_id, pontos)
select usuario_id, diferenca from tmp_missoes_retro_correcoes where diferenca > 0;

-- Insere somente missões históricas ainda não concedidas.
with inseridos as (
  insert into public.xp_eventos(usuario_id, chave, tipo, pontos, detalhes)
  select usuario_id, chave, 'missao', pontos, detalhes
  from tmp_missoes_retro_candidatas
  on conflict (usuario_id, chave) do nothing
  returning usuario_id, pontos
)
insert into tmp_missoes_retro_creditos(usuario_id, pontos)
select usuario_id, pontos from inseridos;

-- Aplica exatamente a soma dos eventos novos e das diferenças corrigidas.
with totais as (
  select usuario_id, sum(pontos)::bigint as pontos
  from tmp_missoes_retro_creditos group by usuario_id
)
update public.usuarios u
set xp_total = u.xp_total + t.pontos
from totais t
where u.id = t.usuario_id;

-- Um único aviso por usuário informa o total recebido nesta regularização.
with totais as (
  select usuario_id, sum(pontos)::bigint as pontos
  from tmp_missoes_retro_creditos group by usuario_id
)
insert into public.notificacoes(usuario_id, tipo, titulo, mensagem, acao, chave)
select usuario_id, 'missao', 'Retroativo de missões',
  'Seu histórico foi analisado e concedeu ' || pontos || ' XP retroativos de missões.',
  'missoes', 'retroativo-missoes-v1'
from totais where pontos > 0
on conflict (usuario_id, chave) do nothing;

-- Resumo exibido ao final da execução no SQL Editor.
select count(*)::integer as usuarios_bonificados,
       coalesce(sum(pontos), 0)::bigint as xp_total_concedido
from (
  select usuario_id, sum(pontos)::bigint as pontos
  from tmp_missoes_retro_creditos group by usuario_id
) resumo;

commit;
