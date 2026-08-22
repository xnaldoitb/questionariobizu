-- ============================================================
-- QUESTIONARIO BIZU - SESSAO UNICA PARA ALUNOS
-- Permite somente uma sessao ativa por aluno.
-- Administradores e ADM Supremo nao possuem essa restricao.
-- ============================================================

alter table public.usuarios
    add column if not exists sessao_ativa_id uuid,
    add column if not exists sessao_ativa_expira_em timestamptz;

create index if not exists idx_usuarios_sessao_ativa
    on public.usuarios (sessao_ativa_id)
    where sessao_ativa_id is not null;

-- Registra a sessao de forma atomica. Retorna TRUE somente quando
-- o aluno nao possui outra sessao valida naquele momento.
create or replace function public.iniciar_sessao_exclusiva_aluno(
    p_usuario_id uuid,
    p_sessao_id uuid,
    p_expira_em timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_linhas integer;
begin
    update public.usuarios
       set sessao_ativa_id = p_sessao_id,
           sessao_ativa_expira_em = p_expira_em
     where id = p_usuario_id
       and perfil = 'aluno'
       and (
            sessao_ativa_id is null
            or sessao_ativa_expira_em is null
            or sessao_ativa_expira_em <= now()
       );

    get diagnostics v_linhas = row_count;
    return v_linhas = 1;
end;
$$;

revoke all on function public.iniciar_sessao_exclusiva_aluno(uuid, uuid, timestamptz) from public;
revoke all on function public.iniciar_sessao_exclusiva_aluno(uuid, uuid, timestamptz) from anon;
revoke all on function public.iniciar_sessao_exclusiva_aluno(uuid, uuid, timestamptz) from authenticated;
grant execute on function public.iniciar_sessao_exclusiva_aluno(uuid, uuid, timestamptz) to service_role;

-- Limpa eventuais valores vencidos deixados por sessoes antigas.
update public.usuarios
   set sessao_ativa_id = null,
       sessao_ativa_expira_em = null
 where sessao_ativa_expira_em is not null
   and sessao_ativa_expira_em <= now();
