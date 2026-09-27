-- v4.56.2: evita bloqueio falso por navegador/PWA e sessões abandonadas.
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

  perform 1 from public.usuarios where id = p_usuario_id and perfil = 'aluno' for update;
  if not found then
    return query select false, null::uuid, 0, false;
    return;
  end if;

  -- Fecha reservas vencidas ou sem atividade por 30 minutos. Fechar o navegador
  -- ou abandonar a PWA não mantém uma vaga presa durante as 12 horas do token.
  delete from public.sessoes_dispositivo
  where usuario_id = p_usuario_id
    and (expira_em <= now() or ultimo_acesso_em <= now() - interval '30 minutes');

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

  -- Se as duas vagas ainda estiverem ocupadas, substitui automaticamente a
  -- sessão menos recente. A senha já foi validada antes desta função.
  if v_quantidade >= p_limite then
    delete from public.sessoes_dispositivo
    where id = (
      select id from public.sessoes_dispositivo
      where usuario_id = p_usuario_id and expira_em > now()
      order by ultimo_acesso_em asc, criada_em asc
      limit 1
    );
    v_quantidade := greatest(v_quantidade - 1, 0);
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
