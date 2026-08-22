import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';

function sortRanking(entries) {
    return entries.sort(
        (a, b) =>
            Number(b.acertos) - Number(a.acertos) ||
            Number(b.percentual) - Number(a.percentual) ||
            Number(b.respondidas) - Number(a.respondidas)
    );
}

async function loadFromView() {
    const { data, error } = await db()
        .from('ranking_usuarios')
        .select('usuario_id,nome,usuario,sessoes,respondidas,acertos,percentual');

    if (error) throw error;

    return sortRanking((data || []).map((entry) => ({
        ...entry,
        sessoes: Number(entry.sessoes || 0),
        respondidas: Number(entry.respondidas || 0),
        acertos: Number(entry.acertos || 0),
        percentual: Number(entry.percentual || 0)
    })));
}

async function loadFallback() {
    const { data, error } = await db()
        .from('sessoes')
        .select('usuario_id,respondidas,acertos,usuarios(nome,usuario)')
        .not('finalizada_em', 'is', null)
        .gt('respondidas', 0);

    if (error) throw error;

    const map = new Map();
    for (const session of data || []) {
        const entry = map.get(session.usuario_id) || {
            usuario_id: session.usuario_id,
            nome: session.usuarios?.nome,
            usuario: session.usuarios?.usuario,
            sessoes: 0,
            respondidas: 0,
            acertos: 0
        };
        entry.sessoes += 1;
        entry.respondidas += Number(session.respondidas || 0);
        entry.acertos += Number(session.acertos || 0);
        map.set(session.usuario_id, entry);
    }

    return sortRanking([...map.values()].map((entry) => ({
        ...entry,
        percentual: entry.respondidas
            ? Math.round((entry.acertos / entry.respondidas) * 100)
            : 0
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
        return json(500, { erro: error.message });
    }
};
