# Banco de Questões CFAP/PMPA — Vercel

Aplicação modular com frontend estático, API Serverless da Vercel e banco PostgreSQL no Supabase.

## Desenvolvimento local

1. Copie `.env.example` para `.env`.
2. Preencha `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `JWT_SECRET`.
3. Execute:

```powershell
npm install
npm run check
npm run dev
```

A Vercel CLI exibirá o endereço local, normalmente `http://localhost:3000`.

## Publicação

Conecte o repositório do GitHub à Vercel e cadastre as variáveis:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

O diretório `public` é servido automaticamente e os endpoints ficam em `/api`.

## Segurança

Nunca envie `.env` ao GitHub. A chave `SUPABASE_SERVICE_ROLE_KEY` deve existir somente nas variáveis da Vercel e no `.env` local.
