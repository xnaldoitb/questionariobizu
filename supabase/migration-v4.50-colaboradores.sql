-- Questionário Bizu v4.50 — reconhecimento institucional de colaboradores.
-- Pode ser executada mais de uma vez com segurança.

alter table public.usuarios add column if not exists colaborador boolean not null default false;
alter table public.usuarios add column if not exists colaborador_desde timestamptz;

create table if not exists public.colaboracoes_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  acao text not null check (acao in ('concedido', 'removido')),
  xp_concedido integer not null default 0 check (xp_concedido between 0 and 100000),
  criado_por_admin_id uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists colaboracoes_usuario_historico_idx
  on public.colaboracoes_usuario(usuario_id, criado_em desc);

alter table public.colaboracoes_usuario enable row level security;
revoke all on public.colaboracoes_usuario from public, anon, authenticated;
grant select, insert on public.colaboracoes_usuario to service_role;

create or replace view public.ranking_usuarios as
select
  u.id as usuario_id,
  u.nome,
  u.usuario,
  u.perfil,
  u.vip,
  u.xp_total,
  count(distinct r.sessao_id)::bigint as sessoes,
  count(r.id)::bigint as respondidas,
  count(r.id) filter (where r.acertou)::bigint as acertos,
  case when count(r.id) > 0
    then round((count(r.id) filter (where r.acertou))::numeric / count(r.id)::numeric * 100)::integer
    else 0 end as percentual,
  u.premium,
  u.plano_atual,
  u.colaborador
from public.usuarios u
left join public.respostas r
  on r.usuario_id = u.id
 and r.pulada = false
 and r.resposta_marcada is not null
group by u.id, u.nome, u.usuario, u.perfil, u.vip, u.xp_total, u.premium, u.plano_atual, u.colaborador;

revoke all on public.ranking_usuarios from public, anon, authenticated;
grant select on public.ranking_usuarios to service_role;
