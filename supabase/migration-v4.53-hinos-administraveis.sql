-- v4.53: acervo de hinos administrável e armazenamento público de áudio.
create table if not exists public.hinos (
  slug text primary key,
  titulo text not null,
  autoria text,
  origem text,
  secoes jsonb not null default '[]'::jsonb,
  audio text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint hinos_slug_formato check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint hinos_secoes_array check (jsonb_typeof(secoes) = 'array')
);

create index if not exists hinos_ativo_ordem_idx on public.hinos (ativo, ordem, titulo);
alter table public.hinos enable row level security;
revoke all on public.hinos from public, anon, authenticated;
grant select, insert, update, delete on public.hinos to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hinos-audio', 'hinos-audio', true, 20971520, array['audio/mpeg','audio/mp3','audio/mp4','audio/ogg','audio/wav','audio/x-wav'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
