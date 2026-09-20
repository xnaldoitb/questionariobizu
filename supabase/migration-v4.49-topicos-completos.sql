-- Questionário Bizu v4.49 — moderação e reações nos tópicos.
-- Pode ser executada mais de uma vez com segurança.

create table if not exists public.topico_reacoes (
  topico_id bigint not null references public.topicos_comunidade(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  reacao text not null check (reacao in ('gostei', 'nao_gostei')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (topico_id, usuario_id)
);

create index if not exists topico_reacoes_topico_idx
  on public.topico_reacoes(topico_id, reacao);

alter table public.topico_reacoes enable row level security;
revoke all on public.topico_reacoes from public, anon, authenticated;
grant select, insert, update, delete on public.topico_reacoes to service_role;
