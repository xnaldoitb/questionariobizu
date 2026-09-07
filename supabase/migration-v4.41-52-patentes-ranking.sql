-- Questionário Bizu v4.41: expansão da progressão para 52 patentes.
alter table public.usuarios
  add column if not exists patente_notificada_nivel smallint not null default 0;

alter table public.usuarios
  drop constraint if exists usuarios_patente_notificada_nivel_check;

alter table public.usuarios
  add constraint usuarios_patente_notificada_nivel_check
    check (patente_notificada_nivel between 0 and 51);

-- Permite apresentar uma vez a patente correspondente ao novo sistema.
update public.usuarios
set patente_notificada_nivel = 0
where patente_notificada_nivel <> 0;

comment on column public.usuarios.patente_notificada_nivel is
  'Maior nível de patente já apresentado ao usuário (0 a 51).';

revoke all on public.usuarios from public, anon, authenticated;
grant select, insert, update, delete on public.usuarios to service_role;
