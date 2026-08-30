-- v4.24: integridade de simulados, auditoria administrativa mínima e permissões.

alter table public.sessoes
    add column if not exists questoes_ids bigint[] not null default '{}'::bigint[];

alter table public.sessoes drop constraint if exists sessoes_questoes_ids_limite;
alter table public.sessoes add constraint sessoes_questoes_ids_limite
    check (cardinality(questoes_ids) between 0 and 5000);

create table if not exists public.auditoria_admin (
    id bigint generated always as identity primary key,
    ator_id uuid references public.usuarios(id) on delete set null,
    acao text not null check (char_length(acao) between 3 and 80),
    alvo_tipo text not null check (alvo_tipo in ('usuario', 'plano', 'pagamento', 'sistema')),
    alvo_id text,
    detalhes jsonb not null default '{}'::jsonb,
    criado_em timestamptz not null default now()
);

create index if not exists auditoria_admin_criado_em_idx
    on public.auditoria_admin (criado_em desc);
create index if not exists auditoria_admin_ator_idx
    on public.auditoria_admin (ator_id, criado_em desc);

alter table public.auditoria_admin enable row level security;
revoke all on public.auditoria_admin from public, anon, authenticated;
grant select, insert, delete on public.auditoria_admin to service_role;
grant usage, select on sequence public.auditoria_admin_id_seq to service_role;

-- A função de snapshot é usada apenas pelo trigger, nunca como RPC pública.
revoke execute on function public.preencher_snapshot_resposta()
    from public, anon, authenticated;

