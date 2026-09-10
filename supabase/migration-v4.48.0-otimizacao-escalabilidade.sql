-- Questionário Bizu v4.48.0 · métricas agregadas de XP e missões.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar a v4.48.
-- Não remove histórico, XP, patentes, usuários ou pagamentos.

begin;

create index if not exists respostas_usuario_capitulo_questao_recente_idx
  on public.respostas(usuario_id, capitulo_id_snapshot, questao_id, respondida_em desc)
  where pulada = false;

create or replace function public.metricas_missoes_v448(
  p_usuario_id uuid,
  p_dia date,
  p_inicio_semana date
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with limites as (
    select
      (p_dia::timestamp at time zone 'America/Belem') as inicio_dia,
      ((p_dia + 1)::timestamp at time zone 'America/Belem') as fim_dia,
      (p_inicio_semana::timestamp at time zone 'America/Belem') as inicio_semana,
      (((p_dia + 1)::timestamp at time zone 'America/Belem') - interval '120 days') as inicio_historico
  ),
  semana as (
    select r.id, r.acertou, r.respondida_em,
           r.disciplina_id_snapshot, r.capitulo_id_snapshot
      from public.respostas r, limites l
     where r.usuario_id = p_usuario_id
       and r.pulada = false
       and r.respondida_em >= l.inicio_semana
       and r.respondida_em < l.fim_dia
  ),
  dia as (
    select s.* from semana s, limites l
     where s.respondida_em >= l.inicio_dia
  ),
  dia_ordenado as (
    select d.acertou,
           row_number() over (order by d.respondida_em desc, d.id desc)::integer as posicao
      from dia d
  ),
  primeira_falha as (
    select min(posicao) as posicao
      from dia_ordenado
     where acertou is not true
  ),
  dias_estudados as (
    select distinct (r.respondida_em at time zone 'America/Belem')::date as dia
      from public.respostas r, limites l
     where r.usuario_id = p_usuario_id
       and r.pulada = false
       and r.respondida_em >= l.inicio_historico
       and r.respondida_em < l.fim_dia
  ),
  sequencia_dias as (
    select deslocamento,
           exists(
             select 1 from dias_estudados e
              where e.dia = p_dia - deslocamento
           ) as estudou
      from generate_series(0, 119) as serie(deslocamento)
  )
  select jsonb_build_object(
    'respostas_dia', (select count(*) from dia),
    'acertos_dia', (select count(*) from dia where acertou is true),
    'disciplinas_dia', (select count(distinct disciplina_id_snapshot) from dia where disciplina_id_snapshot is not null),
    'respostas_semana', (select count(*) from semana),
    'capitulos_semana', (select count(distinct capitulo_id_snapshot) from semana where capitulo_id_snapshot is not null),
    'sequencia_acertos', (
      select count(*) from dia_ordenado, primeira_falha
       where dia_ordenado.acertou is true
         and dia_ordenado.posicao < coalesce(primeira_falha.posicao, 2147483647)
    ),
    'dias_consecutivos', (
      select coalesce(min(deslocamento) filter (where not estudou), 120)
        from sequencia_dias
    )
  );
$$;

create or replace function public.metricas_dominio_capitulo_v448(
  p_usuario_id uuid,
  p_capitulo_id bigint
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ultimas as (
    select distinct on (r.questao_id) r.questao_id, r.acertou
      from public.respostas r
     where r.usuario_id = p_usuario_id
       and r.capitulo_id_snapshot = p_capitulo_id
       and r.pulada = false
       and r.questao_id is not null
     order by r.questao_id, r.respondida_em desc, r.id desc
  )
  select jsonb_build_object(
    'questoes', count(*),
    'acertos', count(*) filter (where acertou is true)
  ) from ultimas;
$$;

create or replace function public.resumo_ranking_usuario_v448(
  p_usuario_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ordenado as (
    select r.*,
           row_number() over (
             order by r.acertos desc, r.percentual desc, r.respondidas desc,
                      lower(r.nome), r.usuario
           ) as posicao
      from public.ranking_usuarios r
  )
  select jsonb_build_object(
    'nome', nome,
    'usuario', usuario,
    'xp_total', xp_total,
    'respondidas', respondidas,
    'acertos', acertos,
    'percentual', percentual,
    'posicao', posicao,
    'lider', posicao = 1
  )
    from ordenado
   where usuario_id = p_usuario_id;
$$;

revoke all on function public.metricas_missoes_v448(uuid,date,date)
  from public, anon, authenticated;
revoke all on function public.metricas_dominio_capitulo_v448(uuid,bigint)
  from public, anon, authenticated;
revoke all on function public.resumo_ranking_usuario_v448(uuid)
  from public, anon, authenticated;
grant execute on function public.metricas_missoes_v448(uuid,date,date)
  to service_role;
grant execute on function public.metricas_dominio_capitulo_v448(uuid,bigint)
  to service_role;
grant execute on function public.resumo_ranking_usuario_v448(uuid)
  to service_role;

commit;
