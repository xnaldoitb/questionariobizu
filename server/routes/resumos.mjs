import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';

export const handler = async (event) => {
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Sessão expirada.' });
    const subscriber = ['admin', 'supremo'].includes(user.perfil)
        || ['ACESSO_ATIVO', 'ACESSO_VITALICIO'].includes(user.acesso_codigo);
    if (!subscriber) return json(403, { erro: 'Os resumos são exclusivos para assinantes com acesso ativo.' });
    if (event.httpMethod !== 'GET') return json(405, { erro: 'Método não permitido.' });

    const { data, error } = await db()
        .from('resumos')
        .select('slug,titulo,disciplina,descricao,ordem')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('disciplina', { ascending: true })
        .order('titulo', { ascending: true });

    if (error) {
        console.error('Falha ao listar resumos:', error.message);
        return json(503, { erro: 'O acervo de resumos ainda não está disponível.' });
    }
    return json(200, { resumos: data || [] });
};
