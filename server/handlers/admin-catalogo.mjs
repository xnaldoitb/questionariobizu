import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json, parseBody } from '../lib/http.mjs';

const BATCH_SIZE = 200;

function chunks(items, size = BATCH_SIZE) {
    const result = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
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
    if (!discipline) {
        return json(404, { erro: 'Disciplina não encontrada.' });
    }

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

    // Sessões usam ON DELETE CASCADE para suas respostas.
    await deleteByIds('sessoes', 'id', [...sessionIds]);

    // Remove respostas remanescentes que apontem para questões da disciplina.
    await deleteByIds('respostas', 'questao_id', questionIds);

    // A ordem abaixo respeita as chaves estrangeiras do banco.
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

    // Exclusão geral direta, sem buscar listas de IDs. Isso evita limites de paginação
    // do PostgREST/Supabase e funciona mesmo com milhares de registros.
    // Usuários permanecem intactos.
    const respostas = await deleteAllRows('respostas', 'id');
    const sessoes = await deleteAllRows('sessoes', 'id');
    const questoes = await deleteAllRows('questoes', 'id');
    const capitulos = await deleteAllRows('capitulos', 'id');
    const disciplinas = await deleteAllRows('disciplinas', 'id');

    return json(200, {
        ok: true,
        removidos: {
            disciplinas,
            capitulos,
            questoes,
            sessoes,
            respostas,
        },
    });
}

export const handler = async (event) => {
    if (!(await requireUser(event, 'supremo'))) {
        return json(403, { erro: 'Acesso restrito.' });
    }

    const body = parseBody(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'POST') {
        if (body.tipo === 'disciplina' && body.acao === 'excluir-todas') {
            try {
                return await deleteAllDisciplines(body.confirmacao);
            } catch (error) {
                console.error('Erro ao excluir todas as disciplinas:', error);
                return json(400, { erro: error.message || 'Não foi possível excluir todas as disciplinas.' });
            }
        }

        if (body.tipo === 'disciplina') {
            const id = String(body.id || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '-');

            if (!id || !body.nome) {
                return json(400, { erro: 'Informe código e nome.' });
            }

            const { data, error } = await db()
                .from('disciplinas')
                .insert({
                    id,
                    nome: body.nome,
                    descricao: body.descricao || null,
                    ordem: Number(body.ordem) || 0,
                    ativo: true,
                })
                .select()
                .single();

            return error
                ? json(400, { erro: error.message })
                : json(201, { item: data });
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
                    nome: body.nome,
                    ativo: true,
                })
                .select()
                .single();

            return error
                ? json(400, { erro: error.message })
                : json(201, { item: data });
        }
    }

    if (event.httpMethod === 'DELETE') {
        if (params.tipo === 'disciplina' && params.acao === 'excluir-todas') {
            try {
                return await deleteAllDisciplines(body.confirmacao);
            } catch (error) {
                console.error('Erro ao excluir todas as disciplinas:', error);
                return json(400, { erro: error.message || 'Não foi possível excluir todas as disciplinas.' });
            }
        }

        if (params.tipo === 'disciplina' && params.acao === 'excluir-completa') {
            try {
                return await deleteDisciplineCompletely(params.id, body.confirmacao);
            } catch (error) {
                console.error('Erro ao excluir disciplina completa:', error);
                return json(400, { erro: error.message || 'Não foi possível excluir a disciplina.' });
            }
        }

        if (params.tipo === 'disciplina') {
            const { error } = await db()
                .from('disciplinas')
                .update({ ativo: false })
                .eq('id', params.id);

            return error
                ? json(400, { erro: error.message })
                : json(200, { ok: true });
        }

        if (params.tipo === 'capitulo') {
            const { error } = await db()
                .from('capitulos')
                .update({ ativo: false })
                .eq('id', Number(params.id));

            return error
                ? json(400, { erro: error.message })
                : json(200, { ok: true });
        }
    }

    return json(405, { erro: 'Método não permitido.' });
};
