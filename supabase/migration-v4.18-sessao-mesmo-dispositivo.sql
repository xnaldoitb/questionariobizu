-- Questionário Bizu v4.18 - renova login no mesmo dispositivo.
-- Mantém o bloqueio quando a conta está ativa em outro aparelho.

alter table public.usuarios
    add column if not exists sessao_ativa_device_hash text;

alter table public.usuarios
    drop constraint if exists usuarios_sessao_device_hash_formato;

alter table public.usuarios
    add constraint usuarios_sessao_device_hash_formato
    check (sessao_ativa_device_hash is null or sessao_ativa_device_hash ~ '^[a-f0-9]{64}$');

drop function if exists public.iniciar_sessao_exclusiva_aluno(uuid, uuid, timestamptz);

create or replace function public.iniciar_sessao_exclusiva_aluno(
    p_usuario_id uuid,
    p_sessao_id uuid,
    p_expira_em timestamptz,
    p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_linhas integer;
begin
    if p_device_hash is null or p_device_hash !~ '^[a-f0-9]{64}$' then
        return false;
    end if;

    update public.usuarios
       set sessao_ativa_id = p_sessao_id,
           sessao_ativa_expira_em = p_expira_em,
           sessao_ativa_device_hash = p_device_hash
     where id = p_usuario_id
       and perfil = 'aluno'
       and (
            sessao_ativa_id is null
            or sessao_ativa_expira_em is null
            or sessao_ativa_expira_em <= now()
            or sessao_ativa_device_hash = p_device_hash
       );

    get diagnostics v_linhas = row_count;
    return v_linhas = 1;
end;
$$;

revoke all on function public.iniciar_sessao_exclusiva_aluno(uuid, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.iniciar_sessao_exclusiva_aluno(uuid, uuid, timestamptz, text) to service_role;

-- Libera uma única vez as reservas antigas, que não registravam o dispositivo.
-- Isso encerra somente a trava de login; histórico, validade e pagamentos permanecem.
update public.usuarios
   set sessao_ativa_id = null,
       sessao_ativa_expira_em = null,
       sessao_ativa_device_hash = null
 where perfil = 'aluno'
   and sessao_ativa_id is not null;
