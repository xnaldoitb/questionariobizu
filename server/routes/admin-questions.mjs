import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';

function normalizeAlternatives(body) {
    const tipo = body.tipo === 'certo_errado' ? 'certo_errado' : 'multipla_escolha';
    const alternativas = Array.isArray(body.alternativas)
        ? body.alternativas.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];

    const quantidadeValida = tipo === 'certo_errado'
        ? alternativas.length === 2
        : [4, 5].includes(alternativas.length);

    if (!quantidadeValida) {
        throw new Error(
            tipo === 'certo_errado'
                ? 'A questão de certo/errado deve ter 2 alternativas.'
                : 'A questão de múltipla escolha deve ter 4 ou 5 alternativas.',
        );
    }

    const correta = Number(body.resposta_correta);
    if (!Number.isInteger(correta) || correta < 0 || correta >= alternativas.length) {
        throw new Error('Gabarito inválido para a quantidade de alternativas informada.');
    }

    return { tipo, alternativas, correta };
}

function questionPayload(body, { editing = false } = {}) {
    const { tipo, alternativas, correta } = normalizeAlternatives(body);
    const disciplina_id = String(body.disciplina_id || '').trim();
    const capitulo_id = Number(body.capitulo_id);
    const enunciado = String(body.enunciado || '').trim();
    const resolucao = String(body.resolucao || '').trim();

    if (!disciplina_id || !Number.isInteger(capitulo_id) || capitulo_id <= 0) {
        throw new Error('Selecione uma disciplina e um capítulo válidos.');
    }
    if (!enunciado) throw new Error('Informe o enunciado da questão.');
    if (!resolucao) throw new Error('Informe a resolução comentada.');

    return {
        disciplina_id,
        capitulo_id,
        tipo,
        enunciado,
        alternativas,
        resposta_correta: correta,
        resolucao,
        dificuldade: ['facil', 'media', 'dificil'].includes(body.dificuldade)
            ? body.dificuldade
            : 'media',
        fonte: String(body.fonte || '').trim() || null,
        ...(editing ? {} : { ativo: true }),
    };
}

export const handler = async (event) => {
    if (!(await requireUser(event, 'supremo'))) {
        return json(403, { erro: 'Acesso restrito.' });
    }

    if (event.httpMethod === 'GET') {
        const params = event.queryStringParameters || {};
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(params.page_size) || 20));
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = db()
            .from('questoes')
            .select('*,capitulos(nome),disciplinas(nome)', { count: 'exact' })
            .order('id', { ascending: false });

        if (params.disciplina) query = query.eq('disciplina_id', params.disciplina);
        if (params.capitulo) query = query.eq('capitulo_id', Number(params.capitulo));
        if (params.tipo && ['multipla_escolha', 'certo_errado'].includes(params.tipo)) {
            query = query.eq('tipo', params.tipo);
        }
        if (params.status === 'ativas') query = query.eq('ativo', true);
        if (params.status === 'inativas') query = query.eq('ativo', false);
        if (params.busca) query = query.ilike('enunciado', `%${String(params.busca).trim()}%`);

        const { data, error, count } = await query.range(from, to);
        return error
            ? json(500, { erro: 'Não foi possível carregar as questões.' })
            : json(200, {
                questoes: data || [],
                total: count || 0,
                pagina: page,
                por_pagina: pageSize,
                paginas: Math.max(1, Math.ceil((count || 0) / pageSize)),
            });
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
        try {
            const payload = questionPayload(body);
            const { data, error } = await db().from('questoes').insert(payload).select().single();
            return error ? json(400, { erro: 'Não foi possível criar a questão.' }) : json(201, { questao: data });
        } catch (error) {
            return json(400, { erro: error.message });
        }
    }

    if (event.httpMethod === 'PUT') {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) return json(400, { erro: 'Questão inválida.' });

        const action = String(body.action || 'update');

        if (action === 'activate' || action === 'deactivate') {
            const { error } = await db()
                .from('questoes')
                .update({ ativo: action === 'activate' })
                .eq('id', id);
            return error ? json(400, { erro: 'Não foi possível atualizar a questão.' }) : json(200, { ok: true });
        }

        if (action === 'duplicate') {
            const { data: original, error: findError } = await db()
                .from('questoes')
                .select('disciplina_id,capitulo_id,tipo,enunciado,alternativas,resposta_correta,resolucao,dificuldade,fonte')
                .eq('id', id)
                .maybeSingle();

            if (findError || !original) return json(404, { erro: 'Questão não encontrada.' });

            const { data, error } = await db()
                .from('questoes')
                .insert({ ...original, ativo: true })
                .select()
                .single();

            return error ? json(400, { erro: 'Não foi possível duplicar a questão.' }) : json(201, { questao: data });
        }

        if (action === 'update') {
            try {
                const payload = questionPayload(body, { editing: true });
                const { error } = await db().from('questoes').update(payload).eq('id', id);
                return error ? json(400, { erro: 'Não foi possível alterar a questão.' }) : json(200, { ok: true });
            } catch (error) {
                return json(400, { erro: error.message });
            }
        }

        return json(400, { erro: 'Ação de questão inválida.' });
    }

    if (event.httpMethod === 'DELETE') {
        const id = Number((event.queryStringParameters || {}).id);
        if (!Number.isInteger(id) || id <= 0) return json(400, { erro: 'Questão inválida.' });

        const { error } = await db().from('questoes').update({ ativo: false }).eq('id', id);
        return error ? json(400, { erro: 'Não foi possível excluir a questão.' }) : json(200, { ok: true });
    }

    return json(405, { erro: 'Método não permitido.' });
};
