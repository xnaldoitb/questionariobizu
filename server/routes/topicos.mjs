import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { cleanText, graphemeLength } from '../platform/community-access.mjs';

const CATEGORIES = new Set(['duvida', 'discussao', 'estudo', 'aviso']);

function publicTopic(topic, currentUserId) {
    if (!topic) return null;
    return {
        id: topic.id,
        titulo: topic.titulo,
        conteudo: topic.conteudo,
        categoria: topic.categoria,
        fechado: Boolean(topic.fechado),
        criado_em: topic.criado_em,
        atualizado_em: topic.atualizado_em,
        proprio: topic.autor_id === currentUserId,
        usuarios: topic.usuarios || null,
    };
}

function publicReply(reply, currentUserId) {
    return {
        id: reply.id,
        topico_id: reply.topico_id,
        conteudo: reply.conteudo,
        criado_em: reply.criado_em,
        propria: reply.autor_id === currentUserId,
        usuarios: reply.usuarios || null,
    };
}

async function topicDetail(id, currentUserId) {
    const [{ data: topic, error }, { data: replies, error: repliesError }] = await Promise.all([
        db().from('topicos_comunidade').select('id,autor_id,titulo,conteudo,categoria,fechado,criado_em,atualizado_em,usuarios:autor_id(nome,perfil)').eq('id', id).maybeSingle(),
        db().from('topico_respostas').select('id,topico_id,autor_id,conteudo,criado_em,usuarios:autor_id(nome,perfil)').eq('topico_id', id).order('criado_em').limit(300),
    ]);
    if (error || repliesError) throw error || repliesError;
    return {
        topico: publicTopic(topic, currentUserId),
        respostas: (replies || []).map((reply) => publicReply(reply, currentUserId)),
    };
}

export const handler = async (event) => {
    if (!['GET', 'POST', 'PUT'].includes(event.httpMethod)) return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    const params = event.queryStringParameters || {};

    try {
        if (event.httpMethod === 'GET') {
            const rate = await consumeRateLimit(event, 'topicos-leitura', {
                limit: 30, windowSeconds: 60, includeIp: false, failClosed: true,
            }, user.id);
            if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
                erro: 'Muitas atualizações dos tópicos. Aguarde um minuto.',
            }, { 'retry-after': '60' });
            if (params.id) return json(200, await topicDetail(params.id, user.id));
            const { data, error } = await db().from('topicos_comunidade')
                .select('id,autor_id,titulo,conteudo,categoria,fechado,criado_em,atualizado_em,usuarios:autor_id(nome,perfil)')
                .order('atualizado_em', { ascending: false }).limit(80);
            if (error) throw error;
            return json(200, {
                topicos: (data || []).map((topic) => publicTopic(topic, user.id)),
            });
        }

        if (event.httpMethod === 'POST') {
            const body = parseBody(event);
            const action = body.action === 'responder' ? 'responder' : 'criar';
            const rate = await consumeRateLimit(event, `topico-${action}`, { limit: action === 'criar' ? 6 : 30, windowSeconds: 3600 }, user.id);
            if (!rate.allowed) return json(429, { erro: 'Limite de publicações atingido. Aguarde para tentar novamente.' });

            if (action === 'criar') {
                const titulo = cleanText(body.titulo, 90);
                const conteudo = cleanText(body.conteudo, 2400);
                const categoria = CATEGORIES.has(body.categoria) ? body.categoria : 'duvida';
                if (categoria === 'aviso' && user.perfil !== 'supremo') return json(403, { erro: 'Somente o Desenvolvedor pode publicar avisos.' });
                if (titulo.length < 5 || graphemeLength(titulo) > 90 || graphemeLength(conteudo) < 5 || graphemeLength(conteudo) > 2400) {
                    return json(400, { erro: 'Informe um título e uma descrição mais completos.' });
                }
                const { data, error } = await db().from('topicos_comunidade')
                    .insert({ autor_id: user.id, titulo, conteudo, categoria }).select('id').single();
                if (error) throw error;
                return json(201, { topico_id: data.id });
            }

            const conteudo = cleanText(body.conteudo, 1600);
            if (!body.topico_id || !conteudo || graphemeLength(conteudo) > 1600) return json(400, { erro: 'Resposta inválida.' });
            const { data: topic } = await db().from('topicos_comunidade').select('id,fechado').eq('id', body.topico_id).maybeSingle();
            if (!topic) return json(404, { erro: 'Tópico não encontrado.' });
            if (topic.fechado) return json(409, { erro: 'Este tópico está encerrado.' });
            const { error } = await db().from('topico_respostas').insert({ topico_id: topic.id, autor_id: user.id, conteudo });
            if (error) throw error;
            await db().from('topicos_comunidade').update({ atualizado_em: new Date().toISOString() }).eq('id', topic.id);
            return json(201, { ok: true });
        }

        if (event.httpMethod === 'PUT') {
            const body = parseBody(event);
            const { data: topic, error: findError } = await db().from('topicos_comunidade').select('id,autor_id').eq('id', body.id).maybeSingle();
            if (findError || !topic) return json(404, { erro: 'Tópico não encontrado.' });
            if (topic.autor_id !== user.id && user.perfil !== 'supremo') return json(403, { erro: 'Você não pode alterar este tópico.' });
            const { error } = await db().from('topicos_comunidade').update({ fechado: Boolean(body.fechado), atualizado_em: new Date().toISOString() }).eq('id', topic.id);
            if (error) throw error;
            return json(200, { ok: true });
        }

        return json(405, { erro: 'Método não permitido.' });
    } catch (error) {
        console.error('Falha nos tópicos:', error.message);
        return json(400, { erro: 'Não foi possível concluir a operação nos tópicos.' });
    }
};
