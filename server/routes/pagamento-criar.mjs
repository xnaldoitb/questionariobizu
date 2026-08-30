import { getUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { createCheckoutPreference, loadPlan } from '../platform/payments.mjs';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { erro: 'Método não permitido.' });
    const user = await getUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    if (user.perfil !== 'aluno') return json(403, { erro: 'Pagamento disponível somente para alunos.' });

    const rate = await consumeRateLimit(event, `pagamento:${user.id}`, { limit: 8, windowSeconds: 60 * 60 });
    if (!rate.allowed) return json(429, { erro: 'Muitas tentativas de pagamento. Aguarde e tente novamente.' });

    const planKey = String(parseBody(event).plano || '').trim().toLowerCase();
    const plan = await loadPlan(planKey);
    if (!plan) return json(400, { erro: 'Plano inválido.' });
    const payment = await createCheckoutPreference({ event, user, plan });
    return json(201, payment);
};
