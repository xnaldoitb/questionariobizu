-- Questionário Bizu v4.47.1 · fila saudável de reconciliação de pagamentos.
-- Execute uma única vez no SQL Editor do Supabase.
-- Não aprova, cancela nem exclui pagamentos.

begin;

drop index if exists public.pagamentos_fila_reconciliacao;
create index pagamentos_fila_reconciliacao
  on public.pagamentos(ultima_consulta_em nulls first, criado_em, id)
  where origem = 'mercado_pago'
    and aplicado_em is null
    and excluido_em is null
    and lower(coalesce(status, 'pendente')) in
      ('pendente', 'pending', 'in_process', 'authorized', 'approved');

create or replace function public.reservar_pagamentos_reconciliacao()
returns setof public.pagamentos
language sql
security definer
set search_path = public
as $$
  with fila as (
    select id
    from public.pagamentos
    where origem = 'mercado_pago'
      and aplicado_em is null
      and excluido_em is null
      and lower(coalesce(status, 'pendente')) in
        ('pendente', 'pending', 'in_process', 'authorized', 'approved')
      and (ultima_consulta_em is null or ultima_consulta_em < now() - interval '4 minutes')
    order by ultima_consulta_em asc nulls first, criado_em asc, id asc
    limit 10
    for update skip locked
  )
  update public.pagamentos as p
     set ultima_consulta_em = now()
    from fila
   where p.id = fila.id
  returning p.*;
$$;

revoke all on function public.reservar_pagamentos_reconciliacao()
  from public, anon, authenticated;
grant execute on function public.reservar_pagamentos_reconciliacao()
  to service_role;

commit;
