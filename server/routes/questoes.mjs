import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';

const ALL_PAGE_SIZE = 250;
const DATABASE_PAGE_SIZE = 500;
const ANSWER_BATCH_SIZE = 150;

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

async function fetchAllCandidates(params) {
    const questions = [];
    let from = 0;

    while (true) {
        const { data, error } = await buildQuery(params)
            .order('id', { ascending: true })
            .range(from, from + DATABASE_PAGE_SIZE - 1);

        if (error) throw error;
        questions.push(...(data || []));
        if (!data || data.length < DATABASE_PAGE_SIZE) break;
        from += DATABASE_PAGE_SIZE;
    }

    return questions;
}

function chunk(items, size) {
    const groups = [];
    for (let index = 0; index < items.length; index += size) {
        groups.push(items.slice(index, index + size));
    }
    return groups;
}

async function filterUnansweredOrWrong(userId, questions) {
    if (!questions.length) return [];

    const latest = new Map();
    const ids = questions.map((question) => question.id);

    for (const batch of chunk(ids, ANSWER_BATCH_SIZE)) {
        const { data, error } = await db()
            .from('respostas')
            .select('questao_id,acertou,respondida_em')
            .eq('usuario_id', userId)
            .eq('pulada', false)
            .in('questao_id', batch)
            .order('respondida_em', { ascending: false });

        if (error) throw error;

        for (const response of data || []) {
            if (!latest.has(response.questao_id)) {
                latest.set(response.questao_id, Boolean(response.acertou));
            }
        }
    }

    return questions.filter((question) => {
        if (!latest.has(question.id)) return true;
        return latest.get(question.id) === false;
    });
}

export const handler = async (event) => {
    const user = await requireUser(event);
    if (!user) {
        return json(401, { erro: 'Não autenticado.' });
    }

    const params = event.queryStringParameters || {};
    if (!params.disciplina) {
        return json(400, { erro: 'Informe a disciplina.' });
    }

    try {
        const reviewOnly = params.revisao === 'pendentes_erros';

        if (reviewOnly) {
            const candidates = await fetchAllCandidates(params);
            const eligible = await filterUnansweredOrWrong(user.id, candidates);

            if (params.limite === 'all') {
                const page = Math.max(Number(params.pagina) || 1, 1);
                const pageSize = Math.min(
                    Math.max(Number(params.por_pagina) || ALL_PAGE_SIZE, 1),
                    500
                );
                const from = (page - 1) * pageSize;
                const pageQuestions = eligible.slice(from, from + pageSize);

                return json(200, {
                    questoes: pageQuestions,
                    paginacao: {
                        pagina: page,
                        por_pagina: pageSize,
                        total: eligible.length,
                        tem_mais: from + pageSize < eligible.length,
                    },
                    filtro_revisao: true,
                });
            }

            const limit = Math.min(Math.max(Number(params.limite) || 50, 1), 500);
            const shuffled = [...eligible].sort(() => Math.random() - 0.5).slice(0, limit);
            return json(200, {
                questoes: shuffled,
                total: shuffled.length,
                elegiveis: eligible.length,
                filtro_revisao: true,
            });
        }

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
                    tem_mais: to + 1 < total,
                },
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
