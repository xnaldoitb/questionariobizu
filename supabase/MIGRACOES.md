# Migrações do Supabase

## Atualização para v4.50.1

Execute, nesta ordem, apenas o que ainda não tiver sido aplicado:

```text
migration-v4.48.1-suporte-otimizado.sql
migration-v4.49-topicos-completos.sql
migration-v4.50-colaboradores.sql
```

A v4.48.1 otimiza a listagem do suporte. A v4.49 cria as reações dos tópicos. A v4.50 adiciona o reconhecimento de Colaborador BIZU. Nenhuma delas remove conversas, mensagens, tópicos, respostas ou usuários existentes.

Se o banco ainda estiver na v4.47.1, execute primeiro `migration-v4.48.0-otimizacao-escalabilidade.sql` e depois a v4.48.1.

## Instalação nova

Use `schema.sql` como base e aplique, na ordem dos nomes e versões, as migrações ainda não incorporadas ao banco. Verifique o histórico do SQL Editor antes de repetir qualquer script.

## Cuidados

- Faça backup antes de qualquer alteração estrutural no banco.
- Não execute novamente a migração retroativa v4.46.1 em produção sem necessidade.
- Nunca copie credenciais do Supabase para arquivos públicos.
- Migrações históricas são documentação e recuperação; não devem ser apagadas do Git.
