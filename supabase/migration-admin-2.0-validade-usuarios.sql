-- Administração 2.0 — validade de acesso de usuários
-- Execute uma vez no SQL Editor do Supabase antes de publicar esta versão.

alter table public.usuarios
    add column if not exists validade_ate timestamptz;

alter table public.usuarios
    add column if not exists desativado_por_validade boolean not null default false;

create index if not exists idx_usuarios_validade_ate
    on public.usuarios (validade_ate)
    where validade_ate is not null;

comment on column public.usuarios.validade_ate is
    'Fim do prazo de acesso. NULL significa acesso sem prazo de expiração.';

comment on column public.usuarios.desativado_por_validade is
    'Indica que a desativação automática ocorreu pelo vencimento do prazo.';
