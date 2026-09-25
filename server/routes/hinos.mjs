import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';

export const handler = async (event) => {
    if (!(await requireUser(event))) return json(401, { erro: 'Sessão expirada.' });
    if (event.httpMethod !== 'GET') return json(405, { erro: 'Método não permitido.' });

    const { data, error } = await db()
        .from('hinos')
        .select('slug,titulo,autoria,origem,secoes,audio,ordem')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('titulo', { ascending: true });

    if (error) {
        console.error('Falha ao listar hinos:', error.message);
        return json(503, { erro: 'O acervo administrável ainda não está disponível.' });
    }
    return json(200, { hinos: data || [] });
};
