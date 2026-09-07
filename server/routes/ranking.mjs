import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';

const PAGE_SIZE = 500;

function publicRankingEntry(entry) {
    return {
        nome: entry.nome,
        usuario: entry.usuario,
        perfil: entry.perfil || 'aluno',
        vip: Boolean(entry.vip),
        premium: Boolean(entry.premium),
        plano_atual: entry.plano_atual || null,
        sessoes: Number(entry.sessoes || 0),
        respondidas: Number(entry.respondidas || 0),
        acertos: Number(entry.acertos || 0),
        percentual: Number(entry.percentual || 0),
    };
}

function sortRanking(entries) {
    return entries.sort(
        (a, b) =>
            Number(b.acertos) - Number(a.acertos) ||
            Number(b.percentual) - Number(a.percentual) ||
            Number(b.respondidas) - Number(a.respondidas) ||
            String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
    );
}

async function loadFromView() {
    const { data, error } = await db()
        .from('ranking_usuarios')
        .select('usuario_id,nome,usuario,perfil,vip,premium,plano_atual,sessoes,respondidas,acertos,percentual');

    if (error) throw error;

    return sortRanking((data || []).map(publicRankingEntry));
}

async function loadFallback() {
    const users = [];
    let userFrom = 0;
    while (true) {
        const { data, error } = await db()
            .from('usuarios')
            .select('id,nome,usuario,perfil,vip,premium,plano_atual')
            .order('id', { ascending: true })
            .range(userFrom, userFrom + PAGE_SIZE - 1);
        if (error) throw error;
        users.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        userFrom += PAGE_SIZE;
    }

    const rows = [];
    let from = 0;

    while (true) {
        const { data, error } = await db()
            .from('respostas')
            .select('id,usuario_id,sessao_id,acertou')
            .eq('pulada', false)
            .not('resposta_marcada', 'is', null)
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    const map = new Map(users.map((registeredUser) => [registeredUser.id, {
        usuario_id: registeredUser.id,
        nome: registeredUser.nome,
        usuario: registeredUser.usuario,
        perfil: registeredUser.perfil || 'aluno',
        vip: Boolean(registeredUser.vip),
        premium: Boolean(registeredUser.premium),
        plano_atual: registeredUser.plano_atual || null,
        sessionIds: new Set(),
        respondidas: 0,
        acertos: 0,
    }]));
    for (const response of rows) {
        const entry = map.get(response.usuario_id);
        if (!entry) continue;

        if (response.sessao_id) entry.sessionIds.add(response.sessao_id);
        entry.respondidas += 1;
        if (response.acertou) entry.acertos += 1;
    }

    return sortRanking([...map.values()].map((entry) => publicRankingEntry({
        nome: entry.nome,
        usuario: entry.usuario,
        perfil: entry.perfil || 'aluno',
        vip: entry.vip,
        premium: entry.premium,
        plano_atual: entry.plano_atual,
        sessoes: entry.sessionIds.size,
        respondidas: entry.respondidas,
        acertos: entry.acertos,
        percentual: entry.respondidas
            ? Math.round((entry.acertos / entry.respondidas) * 100)
            : 0,
    })));
}

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) {
        return json(401, { erro: 'Não autenticado.' });
    }

    const rate = await consumeRateLimit(event, 'ranking-leitura', {
        limit: 20, windowSeconds: 60, includeIp: false, failClosed: true,
    }, user.id);
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
        erro: 'Muitas atualizações do ranking. Aguarde um minuto.',
    }, { 'retry-after': '60' });

    try {
        let ranking;
        try {
            ranking = await loadFromView();
        } catch {
            ranking = await loadFallback();
        }

        return json(200, { ranking });
    } catch (error) {
        console.error('Falha ao carregar ranking:', error.message);
        return json(500, { erro: 'Não foi possível carregar o ranking.' });
    }
};
