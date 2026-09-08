import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { ensureAccessNotification } from '../platform/notifications.mjs';

export const handler = async (event) => {
    if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    const rate = await consumeRateLimit(event, 'notificacoes', {
        limit: 30, windowSeconds: 60, includeIp: false, failClosed: true,
    }, user.id);
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, { erro: 'Muitas consultas de notificações.' });

    try {
        if (event.httpMethod === 'GET') {
            await ensureAccessNotification(user);
            const { data, error } = await db().from('notificacoes')
                .select('id,tipo,titulo,mensagem,acao,referencia_id,lida_em,criado_em')
                .eq('usuario_id', user.id).order('criado_em', { ascending: false }).limit(50);
            if (error) throw error;
            const notifications = data || [];
            return json(200, {
                notificacoes: notifications,
                nao_lidas: notifications.filter((item) => !item.lida_em).length,
            });
        }

        const body = parseBody(event);
        if (body.acao === 'marcar_todas') {
            const { error } = await db().from('notificacoes').update({ lida_em: new Date().toISOString() })
                .eq('usuario_id', user.id).is('lida_em', null);
            if (error) throw error;
            return json(200, { ok: true });
        }
        if (body.acao === 'marcar_lida' && Number.isSafeInteger(Number(body.id))) {
            const { error } = await db().from('notificacoes').update({ lida_em: new Date().toISOString() })
                .eq('id', Number(body.id)).eq('usuario_id', user.id);
            if (error) throw error;
            return json(200, { ok: true });
        }
        return json(400, { erro: 'Ação de notificação inválida.' });
    } catch (error) {
        console.error('Falha nas notificações:', error.message);
        return json(500, { erro: 'Não foi possível carregar as notificações.' });
    }
};
