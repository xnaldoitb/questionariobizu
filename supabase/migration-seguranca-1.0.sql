-- Segurança 1.0: rate limiting persistente para ambientes serverless.
create table if not exists public.rate_limits (
  scope text not null,
  key text not null,
  window_started_at timestamptz not null default now(),
  hits integer not null default 0,
  primary key (scope, key)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_hits integer;
  v_started timestamptz;
begin
  insert into public.rate_limits(scope, key, window_started_at, hits)
  values (p_scope, p_key, v_now, 1)
  on conflict (scope, key) do update
  set
    window_started_at = case
      when public.rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then v_now else public.rate_limits.window_started_at end,
    hits = case
      when public.rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then 1 else public.rate_limits.hits + 1 end
  returning hits, window_started_at into v_hits, v_started;

  allowed := v_hits <= greatest(p_limit, 1);
  remaining := greatest(p_limit - v_hits, 0);
  return next;
end;
$$;

revoke all on function public.consume_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,text,integer,integer) to service_role;
