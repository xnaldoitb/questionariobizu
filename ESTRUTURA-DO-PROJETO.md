# Estrutura do projeto

Esta versão foi reorganizada para facilitar manutenção e evolução.

## Frontend

```text
public/
├── index.html
├── modelo-importacao-disciplina.json
├── css/
│   ├── variables.css      # cores, sombras e temas
│   ├── base.css           # regras globais e formulários
│   ├── layout.css         # grid, cabeçalho e contêineres
│   ├── components.css     # botões, painéis, abas e alertas
│   ├── pages.css          # login, quiz, histórico, ranking e admin
│   └── responsive.css     # adaptações para celular e tablet
└── js/
    ├── app.js             # inicialização e navegação principal
    ├── core/
    │   ├── api.js         # comunicação com Netlify Functions
    │   ├── dom.js         # utilitários de interface
    │   ├── state.js       # estado compartilhado da aplicação
    │   └── views.js       # controle das telas
    └── features/
        ├── auth.js        # login, cadastro e logout
        ├── catalog.js     # disciplinas e capítulos
        ├── quiz.js        # execução e conclusão dos simulados
        ├── reports.js     # histórico e ranking
        └── admin.js       # usuários, questões, importação e exportação
```

## Backend

```text
netlify/functions/
├── _lib/                  # banco, autenticação e respostas HTTP
├── login.mjs
├── cadastro.mjs
├── questoes.mjs
├── responder.mjs
├── sessoes.mjs
├── ranking.mjs
└── admin-*.mjs            # operações protegidas do administrador
```

## Onde editar cada parte

- Aparência geral e cores: `public/css/variables.css`
- Tela de login: `public/index.html` e `public/css/pages.css`
- Funcionamento do login/cadastro: `public/js/features/auth.js`
- Simulados: `public/js/features/quiz.js`
- Histórico e ranking: `public/js/features/reports.js`
- Painel administrativo: `public/js/features/admin.js`
- Funções protegidas: `netlify/functions/`

## Atualização do projeto existente

Preserve o seu arquivo `.env`. Substitua os demais arquivos pela versão reorganizada e execute:

```powershell
npm install
npm run dev
```

O banco existente não precisa ser recriado e `npm run seed` não deve ser executado novamente, salvo quando houver intenção de reimportar o banco inicial.
