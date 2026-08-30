-- ============================================================
-- Questionario Bizu v4.25 - ate dois dispositivos por aluno
-- Execute antes de publicar o codigo v4.25.
-- ============================================================

create table if not exists public.sessoes_dispositivo (
  id uuid primary key,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[a-f0-9]{64}$'),
  criada_em timestamptz not null default now(),
  ultimo_acesso_em timestamptz not null default now(),
  expira_em timestamptz not null,
  unique (usuario_id, device_hash)
);

create index if not exists sessoes_dispositivo_usuario_idx
  on public.sessoes_dispositivo (usuario_id, expira_em desc);
create index if not exists sessoes_dispositivo_expira_idx
  on public.sessoes_dispositivo (expira_em);

alter table public.sessoes_dispositivo enable row level security;
revoke all on table public.sessoes_dispositivo from public, anon, authenticated;
grant all on table public.sessoes_dispositivo to service_role;

-- Mantem autenticados os alunos cuja sessao antiga ainda e valida.
insert into public.sessoes_dispositivo (id, usuario_id, device_hash, expira_em)
select sessao_ativa_id, id, sessao_ativa_device_hash, sessao_ativa_expira_em
from public.usuarios
where perfil = 'aluno'
  and sessao_ativa_id is not null
  and sessao_ativa_device_hash ~ '^[a-f0-9]{64}$'
  and sessao_ativa_expira_em > now()
on conflict do nothing;

create or replace function public.iniciar_sessao_dispositivo_aluno(
  p_usuario_id uuid,
  p_sessao_id uuid,
  p_expira_em timestamptz,
  p_device_hash text,
  p_limite integer default 2
)
returns table (permitido boolean, sessao_id uuid, sessoes_ativas integer, reutilizada boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente uuid;
  v_quantidade integer;
begin
  if p_limite < 1 or p_limite > 5 or p_device_hash !~ '^[a-f0-9]{64}$' or p_expira_em <= now() then
    return query select false, null::uuid, 0, false;
    return;
  end if;

  -- Serializa logins da mesma conta para nunca ultrapassar o limite.
  perform 1 from public.usuarios where id = p_usuario_id and perfil = 'aluno' for update;
  if not found then
    return query select false, null::uuid, 0, false;
    return;
  end if;

  delete from public.sessoes_dispositivo
  where usuario_id = p_usuario_id and expira_em <= now();

  select id into v_existente
  from public.sessoes_dispositivo
  where usuario_id = p_usuario_id and device_hash = p_device_hash and expira_em > now()
  limit 1;

  if v_existente is not null then
    update public.sessoes_dispositivo
    set expira_em = p_expira_em, ultimo_acesso_em = now()
    where id = v_existente;

    select count(*) into v_quantidade
    from public.sessoes_dispositivo where usuario_id = p_usuario_id and expira_em > now();
    return query select true, v_existente, v_quantidade, true;
    return;
  end if;

  select count(*) into v_quantidade
  from public.sessoes_dispositivo where usuario_id = p_usuario_id and expira_em > now();

  if v_quantidade >= p_limite then
    return query select false, null::uuid, v_quantidade, false;
    return;
  end if;

  insert into public.sessoes_dispositivo (id, usuario_id, device_hash, expira_em)
  values (p_sessao_id, p_usuario_id, p_device_hash, p_expira_em);

  return query select true, p_sessao_id, v_quantidade + 1, false;
end;
$$;

revoke all on function public.iniciar_sessao_dispositivo_aluno(uuid, uuid, timestamptz, text, integer)
  from public, anon, authenticated;
grant execute on function public.iniciar_sessao_dispositivo_aluno(uuid, uuid, timestamptz, text, integer)
  to service_role;
