import { timingSafeEqual } from 'node:crypto';
import { json } from './http.mjs';

// Dependency injection allows authentication and job behavior to be tested offline.
export function createScheduledPaymentHandler({ secret, claim, reconcile, rateLimit, log = console.info }) {
    return async event => {
        if (event.httpMethod !== 'GET') return json(405, { erro: 'Método não permitido.' });
        const key = String(secret() || '').trim();
        if (key.length < 32) return json(503, { erro: 'Verificação agendada não configurada.' });
        const supplied = String(event.headers?.authorization || event.headers?.Authorization || '');
        const expected = `Bearer ${key}`;
        const a = Buffer.from(supplied);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return json(401, { erro: 'Não autorizado.' });
        try {
            if (!await rateLimit(event)) return json(429, { erro: 'Aguarde a próxima execução.' });
            const records = await claim();
            const result = await reconcile(records);
            const summary = { ...result, limite_lote: 10, parcial: result.falhas > 0 };
            log('Reconciliação agendada de pagamentos:', summary);
            // Uma falha isolada não invalida as demais verificações do lote. O
            // cron continuará tentando o registro no ciclo seguinte.
            return json(200, summary);
        } catch (error) {
            log('Reconciliação agendada de pagamentos: falha geral; nova tentativa no próximo ciclo.', {
                motivo: String(error?.message || 'erro desconhecido').slice(0, 180),
            });
            return json(503, { erro: 'Não foi possível concluir a verificação. Será tentada no próximo ciclo.' });
        }
    };
}
