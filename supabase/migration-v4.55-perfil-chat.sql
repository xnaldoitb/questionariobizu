-- v4.55: conversas privadas diretas reutilizáveis.
alter table public.chat_salas add column if not exists chave_direta text;
create unique index if not exists chat_salas_chave_direta_uidx
  on public.chat_salas (chave_direta) where chave_direta is not null;
