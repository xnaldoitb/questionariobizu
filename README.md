# Questionário Bizu

Aplicação web progressiva de estudos para o CFP PMPA, com questões por disciplina e capítulo, histórico, ranking, patentes, missões, comunidade, planos e administração.

## Requisitos

- Node.js 20 ou superior;
- projeto no Supabase;
- projeto na Vercel;
- variáveis descritas em `.env.example`.

## Desenvolvimento e validação

1. Copie `.env.example` para `.env` somente no computador local.
2. Instale as dependências com `npm install`.
3. Execute `npm run check` antes de publicar.

## Atualização para v4.48.1

Em um banco que já está na v4.48.0, execute **uma única vez**, no SQL Editor do Supabase:

```text
supabase/migration-v4.48.1-suporte-otimizado.sql
```

Se o banco ainda estiver na v4.47.1, execute primeiro `migration-v4.48.0-otimizacao-escalabilidade.sql` e depois a migração v4.48.1. Nenhuma delas apaga usuários, respostas, conversas, histórico, XP, patentes ou pagamentos.

Consulte `supabase/MIGRACOES.md` antes de executar scripts antigos.

## Fonte das questões

`questions-source.json` é a cópia-fonte usada para reconstrução, validação e carga inicial do banco. Ele deve permanecer no projeto e no Git, mas já está excluído do deploy pela `.vercelignore`.

## Segurança dos pacotes

Nunca compartilhe nem envie ao Git:

- `.env` ou `.env.local`;
- `.git`;
- `.vercel`;
- `node_modules`;
- arquivos ZIP gerados localmente.

O arquivo `.env.example` contém apenas nomes e exemplos das configurações e pode permanecer no repositório.

## Autor

Ronaldo Amorim
