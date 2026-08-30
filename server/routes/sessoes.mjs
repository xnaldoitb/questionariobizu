import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { questionAccessDeniedResponse } from '../platform/question-access.mjs';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SESSION_QUESTIONS = 5000;
const QUESTION_BATCH_SIZE = 150;

function normalizedQuestionIds(value) {
    if (!Array.isArray(value) || !value.length || value.length > MAX_SESSION_QUESTIONS) {
        throw new Error('Seleção de questões inválida.');
    }
    const ids = value.map(Number);
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        throw new Error('Seleção de questões inválida.');
    }
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) throw new Error('A seleção contém questões repetidas.');
    return unique;
}

async function validateSessionQuestions(disciplineId, chapterId, ids) {
    const found = [];
    for (let index = 0; index < ids.length; index += QUESTION_BATCH_SIZE) {
        const batch = ids.slice(index, index + QUESTION_BATCH_SIZE);
        let query = db().from('questoes')
            .select('id').eq('ativo', true).eq('disciplina_id', disciplineId).in('id', batch);
        if (chapterId) query = query.eq('capitulo_id', Number(chapterId));
        const { data, error } = await query;
        if (error) throw error;
        found.push(...(data || []).map((item) => Number(item.id)));
    }
    if (new Set(found).size !== ids.length) {
        throw new Error('Uma ou mais questões não pertencem à disciplina selecionada.');
    }
}

async function countResponses(userId, filters = {}) {
    let query = db()
        .from('respostas')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', userId);

    if (filters.notSkipped) query = query.eq('pulada', false);
    if (typeof filters.correct === 'boolean') query = query.eq('acertou', filters.correct);

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
}

function normalizeHistoryResponse(item) {
    const liveQuestion = item.questoes || null;
    if (liveQuestion) return item;

    return {
        ...item,
        questoes: {
            id: item.questao_id,
            enunciado: item.questao_enunciado || 'Questão removida do banco atual',
            alternativas: item.questao_alternativas || [],
            resposta_correta: item.questao_resposta_correta,
            resolucao: item.questao_resolucao || 'Resolução não disponível no snapshot.',
            disciplinas: {
                nome: item.disciplina_nome_snapshot || item.disciplina_id_snapshot || 'Disciplina anterior',
            },
            capitulos: {
                nome: item.capitulo_nome_snapshot || 'Capítulo anterior',
            },
            removida: true,
        },
    };
}

async function loadDetailedHistory(event, user) {
    const params = event.queryStringParameters || {};
    const page = Math.max(Number(params.pagina) || 1, 1);
    const pageSize = Math.min(
        Math.max(Number(params.por_pagina) || DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE
    );
    const filter = ['all', 'correct', 'wrong'].includes(params.filtro) ? params.filtro : 'all';
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const [answered, correct, wrong, sessionCountResult] = await Promise.all([
        countResponses(user.id, { notSkipped: true }),
        countResponses(user.id, { notSkipped: true, correct: true }),
        countResponses(user.id, { notSkipped: true, correct: false }),
        db()
            .from('sessoes')
            .select('id', { count: 'exact', head: true })
            .eq('usuario_id', user.id),
    ]);

    if (sessionCountResult.error) throw sessionCountResult.error;

    let responseQuery = db()
        .from('respostas')
        .select(`
            id,
            sessao_id,
            questao_id,
            resposta_marcada,
            acertou,
            pulada,
            respondida_em,
            questao_enunciado,
            questao_alternativas,
            questao_resposta_correta,
            questao_resolucao,
            disciplina_id_snapshot,
            disciplina_nome_snapshot,
            capitulo_id_snapshot,
            capitulo_nome_snapshot,
            questoes(
                id,
                enunciado,
                alternativas,
                resposta_correta,
                resolucao,
                disciplinas(nome),
                capitulos(nome)
            )
        `, { count: 'exact' })
        .eq('usuario_id', user.id)
        .eq('pulada', false);

    if (filter === 'correct') responseQuery = responseQuery.eq('acertou', true);
    if (filter === 'wrong') responseQuery = responseQuery.eq('acertou', false);

    const { data: responses, count, error } = await responseQuery
        .order('respondida_em', { ascending: false })
        .range(from, to);

    if (error) throw error;

    const percentage = answered ? Math.round((correct / answered) * 100) : 0;
    const total = count || 0;

    return json(200, {
        respostas: (responses || []).map(normalizeHistoryResponse),
        sessoes_total: sessionCountResult.count || 0,
        estatisticas: {
            respondidas: answered,
            acertos: correct,
            erros: wrong,
            percentual: percentage,
        },
        paginacao: {
            pagina: page,
            por_pagina: pageSize,
            total,
            total_paginas: Math.max(Math.ceil(total / pageSize), 1),
            tem_mais: to + 1 < total,
        },
    });
}

export const handler = async (event) => {
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    if (event.httpMethod === 'GET') {
        const detailed = event.queryStringParameters?.detalhado === '1';

        if (detailed) {
            try {
                return await loadDetailedHistory(event, user);
            } catch (error) {
                console.error('Falha ao carregar histórico detalhado:', error.message);
                return json(500, { erro: 'Não foi possível carregar o histórico.' });
            }
        }

        const { data: sessions, error } = await db()
            .from('sessoes')
            .select('*,disciplinas(nome),capitulos(nome)')
            .eq('usuario_id', user.id)
            .not('finalizada_em', 'is', null)
            .order('finalizada_em', { ascending: false })
            .limit(100);

        return error
            ? json(500, { erro: 'Não foi possível carregar as sessões.' })
            : json(200, { sessoes: sessions });
    }

    if (event.httpMethod === 'DELETE') {
        const { error } = await db().from('sessoes').delete().eq('usuario_id', user.id);
        return error ? json(500, { erro: 'Não foi possível apagar o histórico.' }) : json(200, { ok: true });
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
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

        let questionIds;
        try {
            questionIds = normalizedQuestionIds(body.questoes_ids);
            await validateSessionQuestions(
                String(body.disciplina_id || ''),
                body.capitulo_id || null,
                questionIds,
            );
        } catch (error) {
            return json(400, { erro: error.message });
        }

        const { data, error } = await db()
            .from('sessoes')
            .insert({
                usuario_id: user.id,
                disciplina_id: body.disciplina_id,
                capitulo_id: body.capitulo_id || null,
                questoes_ids: questionIds,
                total: questionIds.length,
            })
            .select()
            .single();

        return error ? json(500, { erro: 'Não foi possível iniciar o simulado.' }) : json(201, { sessao: data });
    }

    if (event.httpMethod === 'PUT') {
        const { data: session, error: sessionError } = await db().from('sessoes')
            .select('id,questoes_ids,finalizada_em').eq('id', body.id).eq('usuario_id', user.id).maybeSingle();
        if (sessionError || !session) return json(404, { erro: 'Sessão não encontrada.' });
        if (session.finalizada_em) return json(409, { erro: 'Esta sessão já foi finalizada.' });

        const { data: answers, error: answersError } = await db().from('respostas')
            .select('acertou,pulada').eq('sessao_id', session.id).eq('usuario_id', user.id);
        if (answersError) return json(500, { erro: 'Não foi possível calcular o resultado.' });
        const rows = answers || [];
        const answered = rows.filter((item) => !item.pulada).length;
        const correct = rows.filter((item) => !item.pulada && item.acertou).length;
        const skipped = rows.filter((item) => item.pulada).length;
        const percentage = answered ? Math.round((correct / answered) * 100) : 0;

        const { data, error } = await db()
            .from('sessoes')
            .update({
                total: (session.questoes_ids || []).length,
                respondidas: answered,
                acertos: correct,
                puladas: skipped,
                percentual: percentage,
                finalizada_em: new Date().toISOString(),
            })
            .eq('id', body.id)
            .eq('usuario_id', user.id)
            .select()
            .single();

        return error ? json(500, { erro: 'Não foi possível finalizar o simulado.' }) : json(200, { sessao: data });
    }

    return json(405, { erro: 'Método não permitido.' });
};
