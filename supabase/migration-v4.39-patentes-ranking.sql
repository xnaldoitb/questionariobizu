-- Questionário Bizu v4.39: progresso e avisos persistentes das patentes do ranking.
alter table public.usuarios
  add column if not exists patente_notificada_nivel smallint not null default 0
    check (patente_notificada_nivel between 0 and 17),
  add column if not exists papirao_notificado boolean not null default false;

comment on column public.usuarios.patente_notificada_nivel is
  'Maior nível de patente já apresentado ao usuário (0 a 17).';
comment on column public.usuarios.papirao_notificado is
  'Indica se a conquista temporária PAPIRÃO já foi apresentada no ciclo atual do ranking.';

-- As colunas ficam protegidas pelas políticas já aplicadas a public.usuarios.
revoke all on public.usuarios from public, anon, authenticated;
grant select, insert, update, delete on public.usuarios to service_role;
