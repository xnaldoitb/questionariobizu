-- ============================================================
-- QUESTIONARIO BIZU v4.7
-- Teste gratuito de 30 minutos + conta acessível após vencimento
-- ============================================================

alter table public.usuarios
    add column if not exists acesso_teste boolean not null default false,
    add column if not exists teste_expira_em timestamptz;

create index if not exists idx_usuarios_teste_expira_em
    on public.usuarios (teste_expira_em)
    where acesso_teste = true and teste_expira_em is not null;

comment on column public.usuarios.acesso_teste is
    'Indica cadastro próprio em período de teste gratuito. O teste é encerrado ao liberar validade normal ou VIP.';

comment on column public.usuarios.teste_expira_em is
    'Fim do teste gratuito iniciado no momento do cadastro próprio.';

-- Versões anteriores desativavam a conta quando a validade acabava.
-- A partir da v4.7, vencimento bloqueia somente as questões. Essas contas
-- voltam a poder autenticar, preservando histórico, ranking e demais áreas.
update public.usuarios
   set ativo = true
 where desativado_por_validade = true
   and status_aprovacao = 'aprovado'
   and ativo = false;
