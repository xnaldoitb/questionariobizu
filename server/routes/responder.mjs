import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { questionAccessDeniedResponse } from '../platform/question-access.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
export const handler = async (event) => {
  const user = await requireUser(event);
  if (!user) return json(401, { erro: 'Não autenticado.' });
  if (!user.acesso_questoes) {
    return json(403, questionAccessDeniedResponse({
      permitido: false,
      codigo: user.acesso_codigo,
      tipo: user.acesso_tipo,
      mensagem: user.acesso_mensagem,
      teste_expira_em: user.teste_expira_em,
      validade_ate: user.validade_ate,
    }));
  }
  if (event.httpMethod !== 'POST') return json(405, { erro: 'Método não permitido.' });
  const rate = await consumeRateLimit(event, 'responder', {
    limit: 60, windowSeconds: 60, includeIp: false, failClosed: true,
  }, user.id);
  if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
    erro: 'Muitas respostas em pouco tempo. Aguarde um minuto.',
  }, { 'retry-after': '60' });

  const { sessao_id, questao_id, resposta_marcada, pulada = false } = parseBody(event);
  if (!sessao_id || !Number.isSafeInteger(Number(questao_id)) || Number(questao_id) <= 0) {
    return json(400, { erro: 'Sessão ou questão inválida.' });
  }
  const { data: sessao, error: sessaoError } = await db()
    .from('sessoes')
    .select('id,questoes_ids,finalizada_em')
    .eq('id', sessao_id)
    .eq('usuario_id', user.id)
    .maybeSingle();
  if (sessaoError || !sessao || sessao.finalizada_em) {
    return json(403, { erro: 'Sessão inválida ou já finalizada.' });
  }
  if (!(sessao.questoes_ids || []).map(Number).includes(Number(questao_id))) {
    return json(403, { erro: 'Esta questão não pertence ao simulado atual.' });
  }

  const existing = await db().from('respostas').select('id,resposta_marcada,pulada,acertou')
    .eq('sessao_id', sessao_id).eq('questao_id', Number(questao_id)).maybeSingle();
  if (existing.error) return json(500, { erro: 'Não foi possível validar a resposta.' });

  const { data: q, error } = await db().from('questoes').select('resposta_correta,resolucao,alternativas,ativo').eq('id', questao_id).eq('ativo', true).single();
  if (error || !q) return json(404, { erro: 'Questão não encontrada.' });
  const answer = Number(resposta_marcada);
  if (!pulada && (!Number.isInteger(answer) || answer < 0 || answer >= q.alternativas.length)) {
    return json(400, { erro: 'Resposta marcada inválida.' });
  }
  if (existing.data) {
    const sameSubmission = Boolean(existing.data.pulada) === Boolean(pulada)
      && (pulada || Number(existing.data.resposta_marcada) === answer);
    if (!sameSubmission) {
      return json(409, { erro: 'Esta questão já foi respondida neste simulado.' });
    }
    return json(200, {
      correta: q.resposta_correta,
      acertou: Boolean(existing.data.acertou),
      resolucao: q.resolucao,
      repetida: true,
    });
  }
  const acertou = !pulada && Number(resposta_marcada) === q.resposta_correta;
  const saved = await db().from('respostas').insert({ sessao_id, usuario_id: user.id, questao_id, resposta_marcada: pulada ? null : answer, acertou, pulada });
  if (saved.error) return json(saved.error.code === '23505' ? 409 : 500, {
    erro: saved.error.code === '23505'
      ? 'Esta questão já foi respondida neste simulado.'
      : 'Não foi possível registrar a resposta.',
  });
  return json(200, { correta: q.resposta_correta, acertou, resolucao: q.resolucao });
};
