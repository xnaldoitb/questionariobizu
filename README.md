# Banco de Questões CFAP/PMPA — Netlify + Supabase

Versão profissional derivada do `quiz.html` original. As questões deixam de ficar expostas no HTML e passam a ser entregues por Netlify Functions. O login usa apenas **usuário e senha**, sem e-mail.

## Recursos

- Login simples com senha protegida por bcrypt.
- Sessão em cookie `HttpOnly`, `Secure` e `SameSite=Lax`.
- Banco PostgreSQL no Supabase.
- Questões, disciplinas, capítulos, sessões e respostas no banco.
- Histórico individual por usuário.
- Painel administrativo para cadastrar usuários e questões.
- Chave `service_role` disponível apenas nas Netlify Functions.
- Arquivo com todas as questões do HTML original e script de importação.

## 1. Criar o banco no Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor > New query**.
3. Copie e execute `supabase/schema.sql`.
4. Abra **Project Settings > API Keys** e copie:
   - URL do projeto;
   - chave secreta `service_role`/Secret key.

Nunca coloque a chave secreta em arquivos públicos ou no navegador.

## 2. Configurar o projeto local

Instale Node.js e execute na pasta do projeto:

```bash
npm install
```

Crie um arquivo `.env` baseado em `.env.example`:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SECRETA
JWT_SECRET=uma-frase-muito-longa-aleatoria-com-mais-de-32-caracteres
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SuaSenhaForte
```

## 3. Criar administrador e importar questões

No PowerShell, carregue as variáveis ou use um gerenciador `.env`. Depois execute:

```bash
npm run create-admin
npm run seed
```

O comando `seed` importa todas as questões extraídas do `quiz.html` original.

> Atenção: o `seed` substitui as questões existentes. Use-o somente na instalação inicial ou quando desejar restaurar o banco original.

## 4. Testar localmente

```bash
npm run dev
```

Abra o endereço mostrado pelo Netlify CLI. Entre com `ADMIN_USERNAME` e `ADMIN_PASSWORD`.

## 5. Publicar no Netlify

1. Envie esta pasta para um repositório no GitHub.
2. No Netlify, escolha **Add new project > Import an existing project**.
3. Selecione o repositório.
4. O arquivo `netlify.toml` já define:
   - diretório publicado: `public`;
   - funções: `netlify/functions`.
5. Em **Project configuration > Environment variables**, adicione:
   - `SUPABASE_URL`;
   - `SUPABASE_SERVICE_ROLE_KEY`;
   - `JWT_SECRET`.
6. Publique o site.

As variáveis `ADMIN_USERNAME` e `ADMIN_PASSWORD` são necessárias apenas para executar o script local de criação do administrador, não precisam permanecer no Netlify.

## Estrutura

```text
public/                  frontend
netlify/functions/       API protegida
supabase/schema.sql      estrutura do banco
scripts/seed.mjs         importação das questões
scripts/create-admin.mjs criação do primeiro administrador
questions-source.json    conteúdo extraído do HTML original
netlify.toml             configuração de publicação
```

## Segurança

- Não envie `.env` ao GitHub.
- Nunca use a chave secreta do Supabase no frontend.
- Troque imediatamente a senha inicial do administrador após a primeira instalação.
- Use um `JWT_SECRET` aleatório e exclusivo.
- O schema ativa RLS e não cria políticas públicas; as operações passam pelas funções do servidor.

## Organização do código

A versão atual utiliza HTML identado, CSS dividido por finalidade e JavaScript modular. Consulte `ESTRUTURA-DO-PROJETO.md` para localizar rapidamente cada funcionalidade.



## Importação por Excel e questões de Certo/Errado

1. Execute `supabase/migration-tipo-questao.sql` uma vez no SQL Editor.
2. No painel Administração > Questões, baixe `modelo-importacao-questoes.xlsx`.
3. Cada linha da planilha corresponde a uma questão. Use `Múltipla Escolha` ou `Certo ou Errado` na coluna Tipo.
4. Clique em Analisar arquivo, revise o resumo e depois em Confirmar importação.
5. O mesmo arquivo pode conter várias disciplinas e capítulos.

Para questões de certo/errado, preencha Tipo como `Certo ou Errado`; o gabarito aceita `Certo`, `Errado`, `C`, `E`, `V` ou `F`. As colunas C, D e E podem ficar vazias.
