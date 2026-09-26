-- v4.54: acervo de resumos em PDF administrável.
create table if not exists public.resumos (
  slug text primary key,
  titulo text not null,
  disciplina text not null,
  descricao text,
  arquivo text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint resumos_slug_formato check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint resumos_arquivo_armazenado check (arquivo ~ '^[a-z0-9-]+-[0-9]+[.]pdf$')
);

alter table public.resumos drop constraint if exists resumos_arquivo_https;
alter table public.resumos drop constraint if exists resumos_arquivo_armazenado;
update public.resumos
set arquivo = regexp_replace(arquivo, '^.*/resumos-pdf/', '')
where arquivo ~ '^https://.*/resumos-pdf/[a-z0-9-]+-[0-9]+[.]pdf$';
alter table public.resumos add constraint resumos_arquivo_armazenado
  check (arquivo ~ '^[a-z0-9-]+-[0-9]+[.]pdf$');

create index if not exists resumos_ativo_ordem_idx on public.resumos (ativo, ordem, disciplina, titulo);
alter table public.resumos enable row level security;
revoke all on public.resumos from public, anon, authenticated;
grant select, insert, update, delete on public.resumos to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumos-pdf', 'resumos-pdf', false, 31457280, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
