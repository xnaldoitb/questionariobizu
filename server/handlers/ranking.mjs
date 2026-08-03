import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';

export const handler = async (event) => {
    if (!(await requireUser(event))) return json(401, { erro: 'Não autenticado.' });

    const { data, error } = await db()
        .from('sessoes')
        .select('usuario_id,respondidas,acertos,usuarios(nome,usuario)')
        .not('finalizada_em', 'is', null)
        .gt('respondidas', 0);

    if (error) return json(500, { erro: error.message });

    const map = new Map();
    for (const session of data) {
        const entry = map.get(session.usuario_id) || {
            usuario_id: session.usuario_id,
            nome: session.usuarios?.nome,
            usuario: session.usuarios?.usuario,
            sessoes: 0,
            respondidas: 0,
            acertos: 0
        };
        entry.sessoes += 1;
        entry.respondidas += session.respondidas;
        entry.acertos += session.acertos;
        map.set(session.usuario_id, entry);
    }

    const ranking = [...map.values()]
        .map((entry) => ({
            ...entry,
            percentual: entry.respondidas ? Math.round((entry.acertos / entry.respondidas) * 100) : 0
        }))
        .sort((a, b) => b.acertos - a.acertos || b.percentual - a.percentual || b.respondidas - a.respondidas)
        .slice(0, 100);

    return json(200, { ranking });
};
