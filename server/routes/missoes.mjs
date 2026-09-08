import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { missionStatus } from '../platform/xp.mjs';

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    const rate = await consumeRateLimit(event, 'missoes-leitura', {
        limit: 90, windowSeconds: 60, includeIp: false, failClosed: true,
    }, user.id);
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, { erro: 'Aguarde um instante antes de atualizar as missões.' });
    try {
        const institutional = ['admin', 'supremo'].includes(user.perfil);
        return json(200, await missionStatus(user.id, {
            award: true,
            institutional,
        }));
    } catch (error) {
        console.error('Falha ao carregar missões:', error.message);
        return json(500, { erro: 'Não foi possível carregar suas missões.' });
    }
};
