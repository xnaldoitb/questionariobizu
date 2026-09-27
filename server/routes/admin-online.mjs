import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { cleanupCommunity, presenceTotals } from '../platform/community.mjs';

const MAX_FAKE_ONLINE = 9999;

export const handler = async (event) => {
    if (!['GET', 'PUT'].includes(event.httpMethod)) return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    if (user.perfil !== 'supremo') return json(403, { erro: 'Acesso permitido somente ao Desenvolvedor.' });

    const rate = await consumeRateLimit(event, 'admin-online', {
        limit: 30, windowSeconds: 60, includeIp: false, failClosed: true,
    }, user.id);
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, { erro: 'Muitas atualizações. Aguarde um minuto.' });

    try {
        if (event.httpMethod === 'PUT') {
            const value = Number(parseBody(event).fake_online);
            if (!Number.isSafeInteger(value) || value < 0 || value > MAX_FAKE_ONLINE) {
                return json(400, { erro: `O online adicional deve ficar entre 0 e ${MAX_FAKE_ONLINE}.` });
            }
            const { error } = await db().from('configuracoes_online').upsert({
                id: true,
                fake_online: value,
                atualizado_por: user.id,
                atualizado_em: new Date().toISOString(),
            }, { onConflict: 'id' });
            if (error) throw error;
        }

        await cleanupCommunity();
        return json(200, await presenceTotals(user.id, 50));
    } catch (error) {
        console.error('Falha na configuração de online:', error.message);
        return json(500, { erro: 'Não foi possível carregar a configuração de online.' });
    }
};
