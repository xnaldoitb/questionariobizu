import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';

const BATCH_SIZE = 500;

function chunks(items, size = 200) {
    const result = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
}

async function fetchAll(table, columns, orderColumn = 'id') {
    const rows = [];
    let from = 0;

    while (true) {
        const { data, error } = await db()
            .from(table)
            .select(columns)
            .order(orderColumn, { ascending: true })
            .range(from, from + BATCH_SIZE - 1);

        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < BATCH_SIZE) break;
        from += BATCH_SIZE;
    }

    return rows;
}

async function listAdminCatalog() {
    const [disciplinas, capitulos, questionRefs] = await Promise.all([
        fetchAll('disciplinas', 'id,nome,descricao,ordem,ativo', 'ordem'),
        fetchAll('capitulos', 'id,disciplina_id,indice,nome,ativo', 'id'),
        fetchAll('questoes', 'id,disciplina_id,capitulo_id,ativo', 'id'),
    ]);

    const disciplineCounts = new Map();
    const chapterCounts = new Map();

    for (const question of questionRefs) {
        const discipline = disciplineCounts.get(question.disciplina_id) || { total: 0, ativas: 0 };
        discipline.total += 1;
        if (question.ativo) discipline.ativas += 1;
        disciplineCounts.set(question.disciplina_id, discipline);

        const chapter = chapterCounts.get(question.capitulo_id) || { total: 0, ativas: 0 };
        chapter.total += 1;
        if (question.ativo) chapter.ativas += 1;
        chapterCounts.set(question.capitulo_id, chapter);
    }

    return {
        disciplinas: disciplinas.map((discipline) => ({
            ...discipline,
            questoes_total: disciplineCounts.get(discipline.id)?.total || 0,
            questoes_ativas: disciplineCounts.get(discipline.id)?.ativas || 0,
        })),
        capitulos: capitulos.map((chapter) => ({
            ...chapter,
            questoes_total: chapterCounts.get(chapter.id)?.total || 0,
            questoes_ativas: chapterCounts.get(chapter.id)?.ativas || 0,
        })),
    };
}

async function deleteByIds(table, column, ids) {
    if (!ids.length) return;

    for (const batch of chunks(ids)) {
        const { error } = await db().from(table).delete().in(column, batch);
        if (error) throw error;
    }
}

async function deleteDisciplineCompletely(id, confirmation) {
    const { data: discipline, error: disciplineError } = await db()
        .from('disciplinas')
        .select('id,nome')
        .eq('id', id)
        .maybeSingle();

    if (disciplineError) throw disciplineError;
    if (!discipline) return json(404, { erro: 'Disciplina não encontrada.' });

    if (String(confirmation || '').trim() !== discipline.nome) {
        return json(400, {
            erro: 'Confirmação inválida. Digite exatamente o nome da disciplina para excluí-la.',
        });
    }

    const [{ data: chapters, error: chaptersError }, { data: questions, error: questionsError }] = await Promise.all([
        db().from('capitulos').select('id').eq('disciplina_id', id),
        db().from('questoes').select('id').eq('disciplina_id', id),
    ]);

    if (chaptersError) throw chaptersError;
    if (questionsError) throw questionsError;

    const chapterIds = (chapters || []).map((item) => item.id);
    const questionIds = (questions || []).map((item) => item.id);
    const sessionIds = new Set();

    const { data: disciplineSessions, error: disciplineSessionsError } = await db()
        .from('sessoes')
        .select('id')
        .eq('disciplina_id', id);

    if (disciplineSessionsError) throw disciplineSessionsError;
    (disciplineSessions || []).forEach((item) => sessionIds.add(item.id));

    for (const batch of chunks(chapterIds)) {
        const { data: chapterSessions, error } = await db()
            .from('sessoes')
            .select('id')
            .in('capitulo_id', batch);

        if (error) throw error;
        (chapterSessions || []).forEach((item) => sessionIds.add(item.id));
    }

    await deleteByIds('sessoes', 'id', [...sessionIds]);
    await deleteByIds('respostas', 'questao_id', questionIds);
    await deleteByIds('questoes', 'id', questionIds);
    await deleteByIds('capitulos', 'id', chapterIds);

    const { error: deleteDisciplineError } = await db()
        .from('disciplinas')
        .delete()
        .eq('id', id);

    if (deleteDisciplineError) throw deleteDisciplineError;

    return json(200, {
        ok: true,
        excluida: discipline.nome,
        removidos: {
            capitulos: chapterIds.length,
            questoes: questionIds.length,
            sessoes: sessionIds.size,
        },
    });
}

async function deleteAllRows(table, column) {
    const { error, count } = await db()
        .from(table)
        .delete({ count: 'exact' })
        .not(column, 'is', null);

    if (error) throw error;
    return count || 0;
}

async function deleteAllDisciplines(confirmation) {
    const REQUIRED_CONFIRMATION = 'EXCLUIR TODAS AS DISCIPLINAS';

    if (String(confirmation || '').trim().toUpperCase() !== REQUIRED_CONFIRMATION) {
        return json(400, {
            erro: `Confirmação inválida. Digite exatamente: ${REQUIRED_CONFIRMATION}`,
        });
    }

    const respostas = await deleteAllRows('respostas', 'id');
    const sessoes = await deleteAllRows('sessoes', 'id');
    const questoes = await deleteAllRows('questoes', 'id');
    const capitulos = await deleteAllRows('capitulos', 'id');
    const disciplinas = await deleteAllRows('disciplinas', 'id');

    return json(200, {
        ok: true,
        removidos: { disciplinas, capitulos, questoes, sessoes, respostas },
    });
}

export const handler = async (event) => {
    if (!(await requireUser(event, 'supremo'))) {
        return json(403, { erro: 'Acesso restrito.' });
    }

    const body = parseBody(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
        try {
            return json(200, await listAdminCatalog());
        } catch (error) {
            console.error('Falha ao listar conteúdo administrativo:', error.message);
            return json(500, { erro: 'Não foi possível carregar o conteúdo.' });
        }
    }

    if (event.httpMethod === 'POST') {
        if (body.tipo === 'disciplina' && body.acao === 'excluir-todas') {
            try {
                return await deleteAllDisciplines(body.confirmacao);
            } catch (error) {
                console.error('Erro ao excluir todas as disciplinas:', error);
                console.error('Falha ao excluir disciplinas:', error.message);
                return json(400, { erro: 'Não foi possível excluir todas as disciplinas.' });
            }
        }

        if (body.tipo === 'disciplina') {
            const id = String(body.id || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '-');

            if (!id || !body.nome) return json(400, { erro: 'Informe código e nome.' });

            const { data, error } = await db()
                .from('disciplinas')
                .insert({
                    id,
                    nome: String(body.nome).trim(),
                    descricao: body.descricao || null,
                    ordem: Number(body.ordem) || 0,
                    ativo: true,
                })
                .select()
                .single();

            return error ? json(400, { erro: 'Não foi possível criar a disciplina.' }) : json(201, { item: data });
        }

        if (body.tipo === 'capitulo') {
            const { data: maximum } = await db()
                .from('capitulos')
                .select('indice')
                .eq('disciplina_id', body.disciplina_id)
                .order('indice', { ascending: false })
                .limit(1);

            const { data, error } = await db()
                .from('capitulos')
                .insert({
                    disciplina_id: body.disciplina_id,
                    indice: Number(body.indice) || ((maximum?.[0]?.indice || 0) + 1),
                    nome: String(body.nome || '').trim(),
                    ativo: true,
                })
                .select()
                .single();

            return error ? json(400, { erro: 'Não foi possível criar o capítulo.' }) : json(201, { item: data });
        }
    }

    if (event.httpMethod === 'PUT') {
        if (body.tipo === 'disciplina') {
            const id = String(body.id || '').trim();
            if (!id) return json(400, { erro: 'Disciplina inválida.' });

            const payload = {};
            if (body.nome !== undefined) payload.nome = String(body.nome).trim();
            if (body.descricao !== undefined) payload.descricao = String(body.descricao || '').trim() || null;
            if (body.ordem !== undefined) payload.ordem = Number(body.ordem) || 0;
            if (body.ativo !== undefined) payload.ativo = Boolean(body.ativo);

            if (!Object.keys(payload).length) return json(400, { erro: 'Nenhuma alteração informada.' });

            const { error } = await db().from('disciplinas').update(payload).eq('id', id);
            return error ? json(400, { erro: 'Não foi possível atualizar a disciplina.' }) : json(200, { ok: true });
        }

        if (body.tipo === 'capitulo') {
            const id = Number(body.id);
            if (!Number.isInteger(id) || id <= 0) return json(400, { erro: 'Capítulo inválido.' });

            const payload = {};
            if (body.nome !== undefined) payload.nome = String(body.nome).trim();
            if (body.indice !== undefined) payload.indice = Number(body.indice) || 0;
            if (body.ativo !== undefined) payload.ativo = Boolean(body.ativo);

            if (!Object.keys(payload).length) return json(400, { erro: 'Nenhuma alteração informada.' });

            const { error } = await db().from('capitulos').update(payload).eq('id', id);
            return error ? json(400, { erro: 'Não foi possível atualizar o capítulo.' }) : json(200, { ok: true });
        }

        return json(400, { erro: 'Tipo de conteúdo inválido.' });
    }

    if (event.httpMethod === 'DELETE') {
        if (params.tipo === 'disciplina' && params.acao === 'excluir-completa') {
            try {
                return await deleteDisciplineCompletely(params.id, body.confirmacao);
            } catch (error) {
                console.error('Erro ao excluir disciplina completa:', error);
                console.error('Falha ao excluir disciplina:', error.message);
                return json(400, { erro: 'Não foi possível excluir a disciplina.' });
            }
        }

        if (params.tipo === 'disciplina') {
            const { error } = await db().from('disciplinas').update({ ativo: false }).eq('id', params.id);
            return error ? json(400, { erro: 'Não foi possível excluir o capítulo.' }) : json(200, { ok: true });
        }

        if (params.tipo === 'capitulo') {
            const { error } = await db().from('capitulos').update({ ativo: false }).eq('id', Number(params.id));
            return error ? json(400, { erro: 'Não foi possível concluir a operação.' }) : json(200, { ok: true });
        }
    }

    return json(405, { erro: 'Método não permitido.' });
};
