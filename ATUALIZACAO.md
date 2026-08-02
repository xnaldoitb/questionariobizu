# Atualização: cadastro público, ranking e administração

## Como aplicar

Substitua no projeto os diretórios `public` e `netlify/functions` pelos desta versão. Mantenha seu `.env` local.

Não é necessário executar `npm run seed` novamente. As tabelas atuais já suportam as novas funções.

No SQL Editor do Supabase, confirme as permissões:

```sql
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
```

Depois reinicie:

```powershell
npm run dev
```

## Recursos

- Cadastro público por nome, usuário e senha. Novas contas sempre recebem perfil `aluno`.
- Login sem e-mail.
- Histórico por aluno.
- Ranking por total de acertos, aproveitamento e respostas.
- Administração de contas: criar, bloquear, ativar e apagar.
- Administração de disciplinas e capítulos: criar e desativar.
- Cadastro de questões.
- Exportação de disciplina completa em JSON, incluindo títulos, capítulos, questões, alternativas, gabaritos e resoluções.

## Segurança

A chave `SUPABASE_SERVICE_ROLE_KEY` deve permanecer apenas no `.env` local e nas variáveis de ambiente do Netlify. Nunca coloque essa chave no diretório `public` ou no GitHub.

## Importação de disciplina completa

O painel Administração > Questões agora possui a opção **Importar disciplina completa**.

1. Selecione um arquivo `.json` exportado pelo próprio sistema ou baseado no arquivo `public/modelo-importacao-disciplina.json`.
2. Escolha **Mesclar** para manter as questões existentes ou **Substituir** para desativar as questões ativas da disciplina antes da importação.
3. Clique em **Importar arquivo**.

O arquivo inclui disciplina, capítulos, cinco alternativas por questão, gabarito numérico de 0 a 4, resolução, dificuldade e fonte.
