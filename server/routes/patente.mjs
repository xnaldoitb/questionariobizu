import { requireUser } from '../platform/auth.mjs';
import { db } from '../platform/db.mjs';
import { json } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { patentStatus } from '../platform/patents.mjs';

async function rankingLeaderId() {
    const { data, error } = await db().from('ranking_usuarios')
        .select('usuario_id,nome,acertos,percentual,respondidas')
        .limit(5000);
    if (error) return null;
    const ranking = [...(data || [])].sort((a, b) =>
        Number(b.acertos || 0) - Number(a.acertos || 0)
        || Number(b.percentual || 0) - Number(a.percentual || 0)
        || Number(b.respondidas || 0) - Number(a.respondidas || 0)
        || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
    );
    return ranking[0]?.usuario_id || null;
}

async function currentUserIsLeader(userId) {
    const { data, error } = await db().rpc('resumo_ranking_usuario_v448', {
        p_usuario_id: userId,
    });
    if (!error && data) return Boolean(data.lider);
    return (await rankingLeaderId()) === userId;
}

async function currentState(user) {
    const [{ data: notification, error }, leader] = await Promise.all([
        db().from('usuarios')
            .select('patente_notificada_nivel,papirao_notificado,xp_total')
            .eq('id', user.id)
            .single(),
        currentUserIsLeader(user.id),
    ]);
    if (error) throw error;
    const xp = Number(notification?.xp_total || 0);
    const patente = patentStatus(xp);
    const lider = leader && xp > 0;
    const notifiedLevel = Math.max(0, Number(notification?.patente_notificada_nivel || 0));
    const institutional = ['admin', 'supremo'].includes(user.perfil);
    return {
        patente,
        lider,
        notificar_patente: !institutional && patente.nivel > notifiedLevel,
        notificar_papirao: !institutional && lider && !Boolean(notification?.papirao_notificado),
        notifiedLevel,
    };
}

export const handler = async (event) => {
    if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    const rate = await consumeRateLimit(event, 'patente-progresso', {
        limit: 20,
        windowSeconds: 60,
        includeIp: false,
        failClosed: true,
    }, user.id);
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
        erro: 'Muitas consultas de patente. Aguarde um minuto.',
    }, { 'retry-after': '60' });

    try {
        const state = await currentState(user);
        if (event.httpMethod === 'GET') return json(200, state);

        const changes = {
            patente_notificada_nivel: Math.max(state.notifiedLevel, state.patente.nivel),
        };
        if (state.lider) changes.papirao_notificado = true;
        const { error } = await db().from('usuarios').update(changes).eq('id', user.id);
        if (error) throw error;
        return json(200, { ok: true });
    } catch (error) {
        console.error('Falha ao consultar patente:', error.message);
        return json(500, { erro: 'Não foi possível consultar sua patente.' });
    }
};
