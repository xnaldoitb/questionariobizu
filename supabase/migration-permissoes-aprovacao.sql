-- Questionário Bizu - Desenvolvedor e aprovação de cadastros
-- Execute UMA VEZ no Supabase correto antes de publicar esta versão.

begin;

-- Amplia os perfis possíveis.
alter table public.usuarios
    drop constraint if exists usuarios_perfil_check;

alter table public.usuarios
    add constraint usuarios_perfil_check
    check (perfil in ('supremo', 'admin', 'aluno'));

-- Novos cadastros públicos ficam pendentes até aprovação.
alter table public.usuarios
    add column if not exists status_aprovacao text;

update public.usuarios
set status_aprovacao = 'aprovado'
where status_aprovacao is null;

alter table public.usuarios
    alter column status_aprovacao set default 'pendente';

alter table public.usuarios
    alter column status_aprovacao set not null;

alter table public.usuarios
    drop constraint if exists usuarios_status_aprovacao_check;

alter table public.usuarios
    add constraint usuarios_status_aprovacao_check
    check (status_aprovacao in ('pendente', 'aprovado', 'negado'));

-- Contas já existentes permanecem utilizáveis.
update public.usuarios
set status_aprovacao = 'aprovado'
where perfil in ('admin', 'supremo');

-- Ajuda o painel a localizar rapidamente contas pendentes.
create index if not exists idx_usuarios_aprovacao
on public.usuarios (status_aprovacao, perfil, criado_em desc);

-- Garante que exista no máximo um Desenvolvedor.
create unique index if not exists idx_usuarios_unico_supremo
on public.usuarios (perfil)
where perfil = 'supremo';

commit;

-- Depois desta migração, promova SUA conta principal para Desenvolvedor, por exemplo:
-- update public.usuarios
-- set perfil = 'supremo', ativo = true, status_aprovacao = 'aprovado'
-- where usuario = 'SEU_LOGIN';
