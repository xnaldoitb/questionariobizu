import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';
import { questionAccessDeniedResponse } from '../platform/question-access.mjs';
import { parseChapterIds } from '../platform/chapter-filter.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';

const ALL_PAGE_SIZE = 250;
const DATABASE_PAGE_SIZE = 500;
const ANSWER_BATCH_SIZE = 150;

function buildQuery(params, count = undefined) {
    let query = db()
        .from('questoes')
        .select(
            'id,disciplina_id,capitulo_id,tipo,enunciado,alternativas,dificuldade',
            count ? { count } : undefined
        )
        .eq('ativo', true)
        .eq('disciplina_id', params.disciplina);

    if (params.chapterIds.length) {
        query = query.in('capitulo_id', params.chapterIds);
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
    if (!user.acesso_questoes) {
        return json(403, questionAccessDeniedResponse({
            permitido: false,
            codigo: user.acesso_codigo,
            tipo: user.acesso_tipo,
            mensagem: user.acesso_mensagem,
            teste_expira_em: user.teste_expira_em,
            validade_ate: user.validade_ate,
        }));
    }

    const rate = await consumeRateLimit(
        event,
        'listar-questoes',
        { limit: 30, windowSeconds: 60, includeIp: false, failClosed: true },
        user.id,
    );
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
        erro: 'Muitas consultas de questões. Aguarde um minuto e tente novamente.',
    }, { 'retry-after': '60' });

    const params = event.queryStringParameters || {};
    if (!params.disciplina) {
        return json(400, { erro: 'Informe a disciplina.' });
    }
    try {
        params.chapterIds = parseChapterIds(params);
    } catch (error) {
        return json(400, { erro: error.message });
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
        console.error('Falha ao carregar questões:', error.message);
        return json(500, { erro: 'Não foi possível carregar as questões.' });
    }
};
