import { getUser } from '../platform/auth.mjs';
import { db } from '../platform/db.mjs';
import { json } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { latestPaymentForUser, reconcilePaymentsForUser } from '../platform/payments.mjs';

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') return json(405, { erro: 'Método não permitido.' });
    const user = await getUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    const rate = await consumeRateLimit(event, 'consulta-pagamentos', { limit: 30, windowSeconds: 60, includeIp: false, failClosed: true }, user.id);
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, { erro: 'Consulta temporariamente indisponível. Aguarde um minuto.' });
    const consulta = await reconcilePaymentsForUser(user.id);
    const pagamento = await latestPaymentForUser(user.id);
    const { count, error } = await db().from('pagamentos').select('id', { count: 'exact', head: true })
        .eq('usuario_id', user.id).eq('origem', 'mercado_pago').is('aplicado_em', null)
        .in('status', ['pendente', 'pending', 'in_process', 'revisao', 'approved', 'authorized']);
    if (error) throw error;
    const refreshed = await getUser(event);
    return json(200, {
        pagamento,
        usuario: refreshed,
        consulta,
        pendencias: count || 0,
        acesso_questoes: Boolean(refreshed?.acesso_questoes),
        acesso_tipo: refreshed?.acesso_tipo,
    });
};
