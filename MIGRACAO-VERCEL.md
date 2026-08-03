# Migração do Netlify para a Vercel

## O que mudou

- `netlify/functions` foi convertido em rotas dentro de `api/`.
- `netlify.toml` foi removido.
- `vercel.json` controla a aplicação de página única e as funções.
- `npm run dev` agora executa `vercel dev`.
- O frontend continua chamando `/api/...`, portanto não precisa ser reescrito.

## Primeiro deploy

1. Substitua o projeto local por esta versão, preservando `.env`.
2. Execute `npm install` para atualizar `package-lock.json`.
3. Teste com `npm run dev`.
4. Faça commit e push para o GitHub.
5. Na Vercel, importe `xnaldoitb/questionariobizu`.
6. Cadastre `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `JWT_SECRET`.
7. Publique.

## Observação sobre cookies

Em produção o cookie de sessão usa `Secure`, `HttpOnly` e `SameSite=Lax`. Em desenvolvimento local, `Secure` é desativado automaticamente.
