# Migrações do Supabase

## Banco de produção atualmente na v4.47.1

Execute somente:

```text
migration-v4.48.0-otimizacao-escalabilidade.sql
```

O script é idempotente para o índice e substitui apenas as três funções da própria versão. Ele não remove dados.

## Instalação nova

Use `schema.sql` como base e aplique, na ordem dos nomes e versões, as migrações ainda não incorporadas ao banco. Verifique o histórico do SQL Editor antes de repetir qualquer script.

## Cuidados

- Faça backup antes de qualquer alteração estrutural no banco.
- Não execute novamente a migração retroativa v4.46.1 em produção sem necessidade.
- Nunca copie credenciais do Supabase para arquivos públicos.
- Migrações históricas são documentação e recuperação; não devem ser apagadas do Git.
