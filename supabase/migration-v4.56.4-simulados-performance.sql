-- Questionário Bizu v4.56.4
-- Valida até 5.000 questões de um simulado em uma única operação no banco.

create or replace function public.validar_questoes_sessao(
    p_disciplina_id text,
    p_capitulo_id bigint,
    p_ids bigint[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        coalesce(cardinality(p_ids), 0) between 1 and 5000
        and cardinality(p_ids) = (
            select count(distinct item_id)::integer
            from unnest(p_ids) as selected(item_id)
        )
        and cardinality(p_ids) = (
            select count(distinct q.id)::integer
            from public.questoes q
            where q.id = any(p_ids)
              and q.ativo = true
              and q.disciplina_id = p_disciplina_id
              and (p_capitulo_id is null or q.capitulo_id = p_capitulo_id)
        );
$$;

revoke all on function public.validar_questoes_sessao(text, bigint, bigint[]) from public;
grant execute on function public.validar_questoes_sessao(text, bigint, bigint[]) to service_role;
