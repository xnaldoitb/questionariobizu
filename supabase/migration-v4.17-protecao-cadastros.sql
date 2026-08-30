-- Questionário Bizu v4.17 - proteção contra cadastros múltiplos e abuso.
-- Preserva todos os usuários existentes e aplica as regras aos novos cadastros.

alter table public.usuarios
    add column if not exists cadastro_device_hash text;

alter table public.usuarios
    drop constraint if exists usuarios_cadastro_device_hash_formato;

alter table public.usuarios
    add constraint usuarios_cadastro_device_hash_formato
    check (cadastro_device_hash is null or cadastro_device_hash ~ '^[a-f0-9]{64}$');

create unique index if not exists idx_usuarios_cadastro_device_unico
    on public.usuarios (cadastro_device_hash)
    where cadastro_device_hash is not null and perfil = 'aluno';

create or replace function public.proteger_whatsapp_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.perfil = 'aluno' and new.whatsapp is not null then
        perform pg_advisory_xact_lock(hashtext(new.whatsapp));

        if exists (
            select 1
            from public.usuarios u
            where u.whatsapp = new.whatsapp
              and u.perfil = 'aluno'
              and u.id is distinct from new.id
        ) then
            raise unique_violation using message = 'WhatsApp já vinculado a outro cadastro.';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_proteger_whatsapp_usuario on public.usuarios;
create trigger trg_proteger_whatsapp_usuario
before insert or update of whatsapp, perfil on public.usuarios
for each row execute function public.proteger_whatsapp_usuario();

revoke all on function public.proteger_whatsapp_usuario() from public, anon, authenticated;
grant execute on function public.proteger_whatsapp_usuario() to service_role;

comment on column public.usuarios.cadastro_device_hash is
'Identificador irreversível usado para limitar múltiplos testes gratuitos no mesmo navegador.';
