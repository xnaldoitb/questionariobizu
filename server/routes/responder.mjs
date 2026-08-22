import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
export const handler = async (event) => {
  const user = await requireUser(event);
  if (!user) return json(401, { erro: 'Não autenticado.' });
  const { sessao_id, questao_id, resposta_marcada, pulada = false } = parseBody(event);
  if (sessao_id) {
    const { data: sessao, error: sessaoError } = await db()
      .from('sessoes')
      .select('id')
      .eq('id', sessao_id)
      .eq('usuario_id', user.id)
      .maybeSingle();
    if (sessaoError || !sessao) return json(403, { erro: 'Sessão inválida para este usuário.' });
  }

  const { data: q, error } = await db().from('questoes').select('resposta_correta,resolucao').eq('id', questao_id).single();
  if (error || !q) return json(404, { erro: 'Questão não encontrada.' });
  const acertou = !pulada && Number(resposta_marcada) === q.resposta_correta;
  if (sessao_id) {
    await db().from('respostas').upsert({ sessao_id, usuario_id: user.id, questao_id, resposta_marcada: pulada ? null : Number(resposta_marcada), acertou, pulada }, { onConflict: 'sessao_id,questao_id' });
  }
  return json(200, { correta: q.resposta_correta, acertou, resolucao: q.resolucao });
};
