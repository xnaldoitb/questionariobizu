# Banco de Questões CFAP/PMPA — Versão 3.0

Esta versão preserva o Supabase, as Netlify Functions e os dados existentes, mas reorganiza o frontend para facilitar manutenção.

## Organização

- `public/index.html`: casca principal da aplicação.
- `public/components/`: telas e seções HTML separadas.
- `public/css/`: tema, layout, componentes, páginas e responsividade.
- `public/js/core/`: infraestrutura compartilhada.
- `public/js/features/`: autenticação, quiz, relatórios e administração.
- `netlify/functions/`: API protegida.
- `supabase/`: schema e migrações.

## Desenvolvimento

1. Preserve o arquivo `.env` do projeto anterior.
2. Execute `npm install`.
3. Execute `npm run check`.
4. Execute `npm run dev`.
5. Abra `http://localhost:8888`.

Não execute `npm run seed` ao atualizar uma instalação que já possui questões novas.
