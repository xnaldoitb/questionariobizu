-- Questionário Bizu v4.48.1 · listagem otimizada do suporte.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar a v4.48.1.
-- Não apaga conversas nem mensagens existentes.

begin;

create index if not exists suporte_mensagens_conversa_recente_idx
  on public.suporte_mensagens(conversa_id, criado_em desc, id desc);

create or replace function public.listar_suporte_conversas_v4481(
  p_limite integer default 100
) returns table (
  id uuid,
  usuario_id uuid,
  status text,
  atualizado_em timestamptz,
  criado_em timestamptz,
  nome text,
  usuario text,
  ultima_mensagem text,
  ultima_mensagem_em timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.usuario_id,
    c.status,
    c.atualizado_em,
    c.criado_em,
    u.nome,
    u.usuario,
    left(m.mensagem, 140) as ultima_mensagem,
    m.criado_em as ultima_mensagem_em
  from public.suporte_conversas c
  join public.usuarios u on u.id = c.usuario_id
  join lateral (
    select sm.mensagem, sm.criado_em
    from public.suporte_mensagens sm
    where sm.conversa_id = c.id
    order by sm.criado_em desc, sm.id desc
    limit 1
  ) m on true
  order by c.atualizado_em desc, c.id
  limit greatest(1, least(coalesce(p_limite, 100), 100));
$$;

revoke all on function public.listar_suporte_conversas_v4481(integer)
  from public, anon, authenticated;
grant execute on function public.listar_suporte_conversas_v4481(integer)
  to service_role;

commit;
