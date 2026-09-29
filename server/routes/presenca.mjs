import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import {
    presenceTotals,
    removePresence,
    touchPresence,
} from '../platform/community.mjs';

async function snapshot(userId) {
    return presenceTotals(userId, 30);
}

export const handler = async (event) => {
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    try {
        if (event.httpMethod === 'GET') {
            return json(200, await snapshot(user.id));
        }

        const rate = await consumeRateLimit(event, 'presenca', {
            limit: 20, windowSeconds: 60, includeIp: false, failClosed: true,
        }, user.id);
        if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
            erro: 'Muitas atualizações de presença. Aguarde um minuto.',
        }, { 'retry-after': '60' });

        if (event.httpMethod === 'POST') {
            const { atividade = false } = parseBody(event);
            await touchPresence(user.id, { activity: Boolean(atividade) });
            return json(200, await presenceTotals(user.id, 30));
        }

        if (event.httpMethod === 'DELETE') {
            await removePresence(user.id);
            return json(200, await snapshot(user.id));
        }

        return json(405, { erro: 'Método não permitido.' });
    } catch (error) {
        console.error('Falha interna na presença:', error.message);
        return json(500, { erro: 'Não foi possível atualizar a presença.' });
    }
};
