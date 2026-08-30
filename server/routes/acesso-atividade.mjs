import { getUser } from '../platform/auth.mjs';
import { db } from '../platform/db.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';

export const handler = async event => {
    if (event.httpMethod !== 'POST') return json(405, { erro: 'Método não permitido.' });
    const user = await getUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    if (!user.acesso_teste) return json(200, { usuario: user });
    const rate = await consumeRateLimit(event, 'acesso-atividade', { limit: 60, windowSeconds: 60, failClosed: true, includeIp: false }, user.id);
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, { erro: 'Aguarde para retomar o teste.' });
    const { ativo = false } = parseBody(event);
    const { error } = await db().rpc('atualizar_teste_ativo', { p_usuario_id: user.id, p_ativo: ativo === true });
    if (error) throw error;
    return json(200, { usuario: await getUser(event) });
};
