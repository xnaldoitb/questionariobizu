import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';

const ALL_PAGE_SIZE = 250;

function buildQuery(params, count = undefined) {
    let query = db()
        .from('questoes')
        .select(
            'id,disciplina_id,capitulo_id,enunciado,alternativas,dificuldade',
            count ? { count } : undefined
        )
        .eq('ativo', true)
        .eq('disciplina_id', params.disciplina);

    if (params.capitulo) {
        query = query.eq('capitulo_id', Number(params.capitulo));
    }

    return query;
}

export const handler = async (event) => {
    if (!(await requireUser(event))) {
        return json(401, { erro: 'Não autenticado.' });
    }

    const params = event.queryStringParameters || {};
    if (!params.disciplina) {
        return json(400, { erro: 'Informe a disciplina.' });
    }

    try {
        if (params.limite === 'all') {
            const page = Math.max(Number(params.pagina) || 1, 1);
            const pageSize = Math.min(
                Math.max(Number(params.por_pagina) || ALL_PAGE_SIZE, 1),
                500
            );
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, count, error } = await buildQuery(params, 'exact')
                .order('id', { ascending: true })
                .range(from, to);

            if (error) throw error;

            const total = count || 0;
            return json(200, {
                questoes: data || [],
                paginacao: {
                    pagina: page,
                    por_pagina: pageSize,
                    total,
                    tem_mais: to + 1 < total
                }
            });
        }

        const limit = Math.min(Math.max(Number(params.limite) || 50, 1), 500);
        const { data, error } = await buildQuery(params).limit(limit);
        if (error) throw error;

        const shuffled = [...(data || [])].sort(() => Math.random() - 0.5);
        return json(200, { questoes: shuffled, total: shuffled.length });
    } catch (error) {
        return json(500, { erro: error.message });
    }
};
