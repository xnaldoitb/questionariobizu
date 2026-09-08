-- Questionário Bizu v4.46.2 · separa histórico de progressão.
-- Execute uma única vez no SQL Editor do Supabase após a migration v4.44.1.
-- A função é exclusiva do service_role e redefine o progresso de forma atômica.

begin;

create or replace function public.redefinir_progresso_usuario(p_usuario_id uuid)
returns table(novo_xp_total bigint, eventos_removidos bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bonus bigint;
  v_removidos bigint;
begin
  select coalesce(u.xp_bonus_plano, 0)::bigint
    into v_bonus
    from public.usuarios as u
   where u.id = p_usuario_id
   for update;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  delete from public.xp_eventos as e
   where e.usuario_id = p_usuario_id
     and e.tipo <> 'plano';
  get diagnostics v_removidos = row_count;

  delete from public.notificacoes as n
   where n.usuario_id = p_usuario_id
     and n.tipo in ('missao', 'patente');

  update public.usuarios as u
     set xp_total = v_bonus,
         patente_notificada_nivel = 0,
         papirao_notificado = false
   where u.id = p_usuario_id;

  return query select v_bonus, coalesce(v_removidos, 0);
end;
$$;

revoke all on function public.redefinir_progresso_usuario(uuid) from public, anon, authenticated;
grant execute on function public.redefinir_progresso_usuario(uuid) to service_role;

commit;
