# Migrações do Supabase

## Atualização para v4.56.6

Execute `migration-v4.56.6-alta-concorrencia.sql` no SQL Editor antes de publicar o código. Ela consolida carregamento de simulados, confirmação de respostas, XP básico e catálogo administrativo em poucas chamadas ao banco. Não remove nem recalcula usuários, respostas, histórico, pagamentos ou XP existente.

Se ainda não foi aplicada, execute antes `migration-v4.56.4-simulados-performance.sql`.

## Atualização para v4.55

Execute `migration-v4.55-perfil-chat.sql` para permitir conversas privadas diretas reutilizáveis. A edição do próprio perfil e as menções com `@` não exigem tabelas adicionais.

## Atualização para v4.54

Execute `migration-v4.54-resumos-pdf.sql` no SQL Editor do Supabase. Ela cria a tabela de resumos e o armazenamento privado de PDFs de até 30 MB. A visualização e o download passam pela sessão do aplicativo e exigem assinatura ativa. Depois, use **Administração → Resumos** para cadastrar os materiais; a marca d’água é aplicada automaticamente.

## Atualização para v4.53

Execute `migration-v4.53-hinos-administraveis.sql` no SQL Editor do Supabase. Depois, abra **Administração → Hinos e canções** e use **Sincronizar 17 hinos oficiais** uma única vez.

### Atualização anterior: progressão v4.51

Execute, nesta ordem, apenas o que ainda não tiver sido aplicado:

```text
migration-v4.48.1-suporte-otimizado.sql
migration-v4.49-topicos-completos.sql
migration-v4.50-colaboradores.sql
migration-v4.51-xp-rapido.sql
```

A v4.48.1 otimiza a listagem do suporte. A v4.49 cria as reações dos tópicos. A v4.50 adiciona o reconhecimento de Colaborador BIZU. A v4.51 acelera somente os ganhos futuros e controla o limite diário de XP de questões. Nenhuma delas remove conversas, mensagens, tópicos, respostas ou usuários existentes.

Se o banco ainda estiver na v4.47.1, execute primeiro `migration-v4.48.0-otimizacao-escalabilidade.sql` e depois a v4.48.1.

## Instalação nova

Use `schema.sql` como base e aplique, na ordem dos nomes e versões, as migrações ainda não incorporadas ao banco. Verifique o histórico do SQL Editor antes de repetir qualquer script.

## Cuidados

- Faça backup antes de qualquer alteração estrutural no banco.
- Não execute novamente a migração retroativa v4.46.1 em produção sem necessidade.
- Nunca copie credenciais do Supabase para arquivos públicos.
- Migrações históricas são documentação e recuperação; não devem ser apagadas do Git.
