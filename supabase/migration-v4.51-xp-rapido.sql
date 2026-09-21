-- Questionário Bizu v4.51 · progressão rápida com limite diário atômico.
-- Não altera XP, patente, histórico ou posição de nenhum usuário existente.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar a versão.

create or replace function public.conceder_xp_questao_limitado(
  p_usuario_id uuid,
  p_chave text,
  p_tipo text,
  p_pontos integer,
  p_detalhes jsonb default '{}'::jsonb,
  p_limite_diario integer default 5000
) returns table(aplicado boolean, novo_xp_total bigint, pontos_aplicados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_usado bigint := 0;
  v_concedido integer := 0;
  v_evento_id bigint;
  v_inicio timestamptz;
begin
  if p_usuario_id is null or nullif(trim(p_chave), '') is null
     or p_pontos <= 0 or p_limite_diario <= 0 then
    raise exception 'Evento limitado de XP inválido.';
  end if;

  if p_tipo not in ('resposta_valida','resposta_correta','primeiro_acerto','correcao','revisao') then
    raise exception 'Tipo de XP de questão inválido.';
  end if;

  -- A trava por usuário impede que respostas simultâneas ultrapassem o limite.
  select u.xp_total into v_total
    from public.usuarios as u
   where u.id = p_usuario_id
   for update;

  if not found then raise exception 'Usuário não encontrado.'; end if;

  if exists (
    select 1 from public.xp_eventos as e
     where e.usuario_id = p_usuario_id and e.chave = trim(p_chave)
  ) then
    return query select false, v_total, 0;
    return;
  end if;

  v_inicio := date_trunc('day', now() at time zone 'America/Belem') at time zone 'America/Belem';

  select coalesce(sum(e.pontos), 0) into v_usado
    from public.xp_eventos as e
   where e.usuario_id = p_usuario_id
     and e.tipo in ('resposta_valida','resposta_correta','primeiro_acerto','correcao','revisao')
     and e.criado_em >= v_inicio;

  v_concedido := least(p_pontos, greatest(p_limite_diario - v_usado, 0))::integer;
  if v_concedido <= 0 then
    return query select false, v_total, 0;
    return;
  end if;

  insert into public.xp_eventos(usuario_id, chave, tipo, pontos, detalhes)
  values (
    p_usuario_id, trim(p_chave), p_tipo, v_concedido,
    coalesce(p_detalhes, '{}'::jsonb) || jsonb_build_object('limite_diario', p_limite_diario)
  )
  on conflict (usuario_id, chave) do nothing
  returning id into v_evento_id;

  if v_evento_id is null then
    return query select false, v_total, 0;
    return;
  end if;

  update public.usuarios as u
     set xp_total = u.xp_total + v_concedido
   where u.id = p_usuario_id
  returning u.xp_total into v_total;

  return query select true, v_total, v_concedido;
end;
$$;

revoke all on function public.conceder_xp_questao_limitado(uuid,text,text,integer,jsonb,integer)
  from public, anon, authenticated;
grant execute on function public.conceder_xp_questao_limitado(uuid,text,text,integer,jsonb,integer)
  to service_role;

comment on function public.conceder_xp_questao_limitado(uuid,text,text,integer,jsonb,integer) is
  'Concede XP de respostas com idempotência e teto diário atômico no fuso de Belém.';

select 'v4.51 pronta: XP futuro acelerado, sem reposicionar usuários existentes.' as resultado;
