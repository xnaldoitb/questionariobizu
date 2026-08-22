-- Questionário Bizu v4.3
-- VIP, responsável administrativo, histórico preservado em substituições
-- e ranking contabilizado por resposta registrada.
-- Execute UMA VEZ no SQL Editor do Supabase antes de publicar a v4.3.

begin;

-- ============================================================
-- 1) Auditoria e VIP de usuários
-- ============================================================
alter table public.usuarios
    add column if not exists criado_por_admin_id uuid,
    add column if not exists aprovado_por_admin_id uuid,
    add column if not exists responsavel_admin_id uuid,
    add column if not exists vip boolean not null default false,
    add column if not exists vip_desde timestamptz;

alter table public.usuarios drop constraint if exists usuarios_criado_por_admin_id_fkey;
alter table public.usuarios
    add constraint usuarios_criado_por_admin_id_fkey
    foreign key (criado_por_admin_id) references public.usuarios(id) on delete set null;

alter table public.usuarios drop constraint if exists usuarios_aprovado_por_admin_id_fkey;
alter table public.usuarios
    add constraint usuarios_aprovado_por_admin_id_fkey
    foreign key (aprovado_por_admin_id) references public.usuarios(id) on delete set null;

alter table public.usuarios drop constraint if exists usuarios_responsavel_admin_id_fkey;
alter table public.usuarios
    add constraint usuarios_responsavel_admin_id_fkey
    foreign key (responsavel_admin_id) references public.usuarios(id) on delete set null;

create index if not exists idx_usuarios_responsavel_admin
    on public.usuarios (responsavel_admin_id);

create index if not exists idx_usuarios_vip
    on public.usuarios (vip)
    where vip = true;

-- VIP é vitalício: não possui vencimento automático.
update public.usuarios
set validade_ate = null,
    desativado_por_validade = false
where vip = true;

-- ============================================================
-- 2) Snapshot de respostas para preservar histórico quando
--    questões/capítulos forem fisicamente excluídos.
-- ============================================================
alter table public.respostas
    add column if not exists questao_enunciado text,
    add column if not exists questao_alternativas jsonb,
    add column if not exists questao_resposta_correta smallint,
    add column if not exists questao_resolucao text,
    add column if not exists disciplina_id_snapshot text,
    add column if not exists disciplina_nome_snapshot text,
    add column if not exists capitulo_id_snapshot bigint,
    add column if not exists capitulo_nome_snapshot text;

update public.respostas r
set questao_enunciado = coalesce(r.questao_enunciado, q.enunciado),
    questao_alternativas = coalesce(r.questao_alternativas, q.alternativas),
    questao_resposta_correta = coalesce(r.questao_resposta_correta, q.resposta_correta),
    questao_resolucao = coalesce(r.questao_resolucao, q.resolucao),
    disciplina_id_snapshot = coalesce(r.disciplina_id_snapshot, q.disciplina_id),
    disciplina_nome_snapshot = coalesce(r.disciplina_nome_snapshot, d.nome),
    capitulo_id_snapshot = coalesce(r.capitulo_id_snapshot, q.capitulo_id),
    capitulo_nome_snapshot = coalesce(r.capitulo_nome_snapshot, c.nome)
from public.questoes q
left join public.disciplinas d on d.id = q.disciplina_id
left join public.capitulos c on c.id = q.capitulo_id
where r.questao_id = q.id;

create or replace function public.preencher_snapshot_resposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.questao_id is null then
        return new;
    end if;

    select
        q.enunciado,
        q.alternativas,
        q.resposta_correta,
        q.resolucao,
        q.disciplina_id,
        d.nome,
        q.capitulo_id,
        c.nome
    into
        new.questao_enunciado,
        new.questao_alternativas,
        new.questao_resposta_correta,
        new.questao_resolucao,
        new.disciplina_id_snapshot,
        new.disciplina_nome_snapshot,
        new.capitulo_id_snapshot,
        new.capitulo_nome_snapshot
    from public.questoes q
    left join public.disciplinas d on d.id = q.disciplina_id
    left join public.capitulos c on c.id = q.capitulo_id
    where q.id = new.questao_id;

    return new;
end;
$$;

drop trigger if exists trg_respostas_snapshot on public.respostas;
create trigger trg_respostas_snapshot
before insert or update of questao_id on public.respostas
for each row execute function public.preencher_snapshot_resposta();

-- A questão pode ser removida; a resposta continua existindo com o snapshot.
alter table public.respostas alter column questao_id drop not null;
alter table public.respostas drop constraint if exists respostas_questao_id_fkey;
alter table public.respostas
    add constraint respostas_questao_id_fkey
    foreign key (questao_id) references public.questoes(id) on delete set null;

-- Capítulos substituídos podem ser apagados sem apagar sessões históricas.
alter table public.sessoes drop constraint if exists sessoes_capitulo_id_fkey;
alter table public.sessoes
    add constraint sessoes_capitulo_id_fkey
    foreign key (capitulo_id) references public.capitulos(id) on delete set null;

create index if not exists idx_respostas_usuario_questao_recente
    on public.respostas (usuario_id, questao_id, respondida_em desc)
    where pulada = false;

-- ============================================================
-- 3) Substituição completa e transacional de uma disciplina.
--    As questões/capítulos antigos são realmente DELETADOS.
-- ============================================================
create or replace function public.substituir_disciplina_completa(
    p_disciplina jsonb,
    p_capitulos jsonb,
    p_questoes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id text;
    v_capitulos integer := 0;
    v_questoes integer := 0;
begin
    v_id := nullif(trim(p_disciplina->>'id'), '');
    if v_id is null then
        raise exception 'Disciplina inválida.';
    end if;

    insert into public.disciplinas (id, nome, descricao, ordem, ativo)
    values (
        v_id,
        p_disciplina->>'nome',
        nullif(p_disciplina->>'descricao', ''),
        coalesce((p_disciplina->>'ordem')::integer, 0),
        coalesce((p_disciplina->>'ativo')::boolean, true)
    )
    on conflict (id) do update set
        nome = excluded.nome,
        descricao = excluded.descricao,
        ordem = excluded.ordem,
        ativo = excluded.ativo;

    -- O snapshot das respostas mantém histórico/ranking antes da exclusão física.
    delete from public.questoes where disciplina_id = v_id;
    delete from public.capitulos where disciplina_id = v_id;

    insert into public.capitulos (disciplina_id, indice, nome, ativo)
    select
        v_id,
        (item->>'indice')::integer,
        item->>'nome',
        coalesce((item->>'ativo')::boolean, true)
    from jsonb_array_elements(coalesce(p_capitulos, '[]'::jsonb)) item;
    get diagnostics v_capitulos = row_count;

    insert into public.questoes (
        disciplina_id,
        capitulo_id,
        tipo,
        enunciado,
        alternativas,
        resposta_correta,
        resolucao,
        dificuldade,
        fonte,
        ativo
    )
    select
        v_id,
        c.id,
        coalesce(nullif(q.item->>'tipo', ''), 'multipla_escolha'),
        q.item->>'enunciado',
        q.item->'alternativas',
        (q.item->>'resposta_correta')::smallint,
        q.item->>'resolucao',
        coalesce(nullif(q.item->>'dificuldade', ''), 'media'),
        nullif(q.item->>'fonte', ''),
        coalesce((q.item->>'ativo')::boolean, true)
    from jsonb_array_elements(coalesce(p_questoes, '[]'::jsonb)) as q(item)
    join public.capitulos c
      on c.disciplina_id = v_id
     and c.indice = (q.item->>'capitulo_indice')::integer;
    get diagnostics v_questoes = row_count;

    if v_questoes <> jsonb_array_length(coalesce(p_questoes, '[]'::jsonb)) then
        raise exception 'Nem todas as questões puderam ser vinculadas aos capítulos importados.';
    end if;

    return jsonb_build_object(
        'disciplina_id', v_id,
        'capitulos', v_capitulos,
        'questoes', v_questoes
    );
end;
$$;

revoke all on function public.substituir_disciplina_completa(jsonb, jsonb, jsonb) from public;
grant execute on function public.substituir_disciplina_completa(jsonb, jsonb, jsonb) to service_role;

-- ============================================================
-- 4) Ranking imediato: cada resposta efetivamente marcada conta,
--    mesmo se o simulado ainda não foi finalizado.
-- ============================================================
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
'Ranking imediato do Questionário Bizu: cada resposta marcada conta, mesmo em simulados ainda não finalizados.';

revoke all on public.ranking_usuarios from anon, authenticated;
grant select on public.ranking_usuarios to service_role;

commit;
