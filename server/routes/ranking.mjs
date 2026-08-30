import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';

const PAGE_SIZE = 500;

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
        .select('usuario_id,nome,usuario,perfil,vip,premium,sessoes,respondidas,acertos,percentual');

    if (error) throw error;

    return sortRanking((data || []).map((entry) => ({
        ...entry,
        vip: Boolean(entry.vip),
        premium: Boolean(entry.premium),
        sessoes: Number(entry.sessoes || 0),
        respondidas: Number(entry.respondidas || 0),
        acertos: Number(entry.acertos || 0),
        percentual: Number(entry.percentual || 0),
    })));
}

async function loadFallback() {
    const rows = [];
    let from = 0;

    while (true) {
        const { data, error } = await db()
            .from('respostas')
            .select('id,usuario_id,sessao_id,acertou,usuarios(nome,usuario,perfil,vip,premium)')
            .eq('pulada', false)
            .not('resposta_marcada', 'is', null)
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    const map = new Map();
    for (const response of rows) {
        const entry = map.get(response.usuario_id) || {
            usuario_id: response.usuario_id,
            nome: response.usuarios?.nome,
            usuario: response.usuarios?.usuario,
            perfil: response.usuarios?.perfil || 'aluno',
            vip: Boolean(response.usuarios?.vip),
            premium: Boolean(response.usuarios?.premium),
            sessionIds: new Set(),
            respondidas: 0,
            acertos: 0,
        };

        if (response.sessao_id) entry.sessionIds.add(response.sessao_id);
        entry.respondidas += 1;
        if (response.acertou) entry.acertos += 1;
        map.set(response.usuario_id, entry);
    }

    return sortRanking([...map.values()].map((entry) => ({
        usuario_id: entry.usuario_id,
        nome: entry.nome,
        usuario: entry.usuario,
        perfil: entry.perfil || 'aluno',
        vip: entry.vip,
        premium: entry.premium,
        sessoes: entry.sessionIds.size,
        respondidas: entry.respondidas,
        acertos: entry.acertos,
        percentual: entry.respondidas
            ? Math.round((entry.acertos / entry.respondidas) * 100)
            : 0,
    })));
}

export const handler = async (event) => {
    if (!(await requireUser(event))) {
        return json(401, { erro: 'Não autenticado.' });
    }

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
