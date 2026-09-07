-- Questionário Bizu v4.35.4 — defesa em profundidade das APIs e do Supabase.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar esta versão.

alter table public.usuarios enable row level security;
alter table public.disciplinas enable row level security;
alter table public.capitulos enable row level security;
alter table public.questoes enable row level security;
alter table public.sessoes enable row level security;
alter table public.respostas enable row level security;

revoke all on table
  public.usuarios,
  public.disciplinas,
  public.capitulos,
  public.questoes,
  public.sessoes,
  public.respostas
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.usuarios,
  public.disciplinas,
  public.capitulos,
  public.questoes,
  public.sessoes,
  public.respostas
to service_role;

revoke all on table
  public.rate_limits,
  public.auditoria_admin,
  public.pagamentos,
  public.planos_acesso,
  public.sessoes_dispositivo,
  public.presencas_online,
  public.chat_salas,
  public.chat_sala_membros,
  public.chat_mensagens,
  public.suporte_conversas,
  public.suporte_mensagens,
  public.topicos_comunidade,
  public.topico_respostas
from public, anon, authenticated;

revoke all on public.ranking_usuarios from public, anon, authenticated;
grant select on public.ranking_usuarios to service_role;

revoke all on function public.consume_rate_limit(text, text, integer, integer)
from public, anon, authenticated;
revoke all on function public.confirmar_pagamento_pix(uuid, text, text, numeric, text, text)
from public, anon, authenticated;
revoke all on function public.conceder_acesso_plano(uuid, text, uuid)
from public, anon, authenticated;
revoke all on function public.aplicar_periodo_acesso(uuid, integer, boolean)
from public, anon, authenticated;
revoke all on function public.reservar_pagamentos_reconciliacao()
from public, anon, authenticated;
revoke all on function public.atualizar_teste_ativo(uuid, boolean)
from public, anon, authenticated;
revoke all on function public.iniciar_sessao_dispositivo_aluno(uuid, uuid, timestamptz, text, integer)
from public, anon, authenticated;
revoke all on function public.substituir_disciplina_completa(jsonb, jsonb, jsonb)
from public, anon, authenticated;
revoke all on function public.preencher_snapshot_resposta()
from public, anon, authenticated;
revoke all on function public.proteger_whatsapp_usuario()
from public, anon, authenticated;

grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.confirmar_pagamento_pix(uuid, text, text, numeric, text, text) to service_role;
grant execute on function public.conceder_acesso_plano(uuid, text, uuid) to service_role;
grant execute on function public.aplicar_periodo_acesso(uuid, integer, boolean) to service_role;
grant execute on function public.reservar_pagamentos_reconciliacao() to service_role;
grant execute on function public.atualizar_teste_ativo(uuid, boolean) to service_role;
grant execute on function public.iniciar_sessao_dispositivo_aluno(uuid, uuid, timestamptz, text, integer) to service_role;
grant execute on function public.substituir_disciplina_completa(jsonb, jsonb, jsonb) to service_role;
