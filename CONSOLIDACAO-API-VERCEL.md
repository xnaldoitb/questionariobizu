# Consolidação das APIs para Vercel Hobby

Esta versão usa apenas uma função serverless:

- `api/[...route].js`

Ela roteia internamente os mesmos endereços usados pelo frontend:

- `/api/login`
- `/api/logout`
- `/api/cadastro`
- `/api/me`
- `/api/catalogo`
- `/api/questoes`
- `/api/responder`
- `/api/sessoes`
- `/api/ranking`
- `/api/admin-users`
- `/api/admin-catalogo`
- `/api/admin-questions`
- `/api/admin-import`
- `/api/admin-export`

Os handlers continuam separados em `server/handlers/`, facilitando a manutenção sem aumentar a quantidade de funções serverless da implantação.
