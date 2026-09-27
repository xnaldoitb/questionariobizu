-- v4.56: configuração administrativa do total adicional de usuários online.
create table if not exists public.configuracoes_online (
  id boolean primary key default true check (id = true),
  fake_online integer not null default 0 check (fake_online between 0 and 9999),
  atualizado_por uuid references public.usuarios(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes_online (id, fake_online)
values (true, 0)
on conflict (id) do nothing;

alter table public.configuracoes_online enable row level security;
revoke all on public.configuracoes_online from anon, authenticated;
grant select, insert, update on public.configuracoes_online to service_role;
