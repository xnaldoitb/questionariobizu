import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json, parseBody } from '../lib/http.mjs';

export const handler = async (event) => {
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    if (event.httpMethod === 'GET') {
        const detailed = event.queryStringParameters?.detalhado === '1';
        const { data: sessions, error } = await db()
            .from('sessoes')
            .select('*,disciplinas(nome),capitulos(nome)')
            .eq('usuario_id', user.id)
            .not('finalizada_em', 'is', null)
            .order('finalizada_em', { ascending: false })
            .limit(100);

        if (error) return json(500, { erro: error.message });
        if (!detailed) return json(200, { sessoes: sessions });

        const { data: responses, error: responseError } = await db()
            .from('respostas')
            .select(`
                id,
                sessao_id,
                questao_id,
                resposta_marcada,
                acertou,
                pulada,
                respondida_em,
                questoes(
                    id,
                    enunciado,
                    alternativas,
                    resposta_correta,
                    resolucao,
                    disciplinas(nome),
                    capitulos(nome)
                )
            `)
            .eq('usuario_id', user.id)
            .order('respondida_em', { ascending: false })
            .limit(1000);

        return responseError
            ? json(500, { erro: responseError.message })
            : json(200, { sessoes: sessions, respostas: responses });
    }

    if (event.httpMethod === 'DELETE') {
        const { error } = await db().from('sessoes').delete().eq('usuario_id', user.id);
        return error ? json(500, { erro: error.message }) : json(200, { ok: true });
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
        const { data, error } = await db()
            .from('sessoes')
            .insert({
                usuario_id: user.id,
                disciplina_id: body.disciplina_id,
                capitulo_id: body.capitulo_id || null,
                total: body.total || 0
            })
            .select()
            .single();

        return error ? json(500, { erro: error.message }) : json(201, { sessao: data });
    }

    if (event.httpMethod === 'PUT') {
        const { data, error } = await db()
            .from('sessoes')
            .update({
                respondidas: body.respondidas,
                acertos: body.acertos,
                puladas: body.puladas,
                percentual: body.percentual,
                finalizada_em: new Date().toISOString()
            })
            .eq('id', body.id)
            .eq('usuario_id', user.id)
            .select()
            .single();

        return error ? json(500, { erro: error.message }) : json(200, { sessao: data });
    }

    return json(405, { erro: 'Método não permitido.' });
};
