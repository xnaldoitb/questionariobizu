import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { cleanText, graphemeLength } from '../platform/community-access.mjs';

const CATEGORIES = new Set(['duvida', 'discussao', 'estudo', 'aviso']);
const REACTIONS = new Set(['gostei', 'nao_gostei']);

function canManage(topic, user) {
    return Boolean(topic && user && (topic.autor_id === user.id || user.perfil === 'supremo'));
}

function publicTopic(topic, user, metrics = {}) {
    if (!topic) return null;
    return {
        id: topic.id,
        titulo: topic.titulo,
        conteudo: topic.conteudo,
        categoria: topic.categoria,
        fechado: Boolean(topic.fechado),
        criado_em: topic.criado_em,
        atualizado_em: topic.atualizado_em,
        proprio: topic.autor_id === user.id,
        pode_gerenciar: canManage(topic, user),
        respostas: Number(metrics.respostas || 0),
        gostei: Number(metrics.gostei || 0),
        nao_gostei: Number(metrics.nao_gostei || 0),
        minha_reacao: metrics.minha_reacao || null,
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

function metricsFor(topicId, replies = [], reactions = [], currentUserId = null) {
    const sameTopic = (item) => String(item.topico_id) === String(topicId);
    const own = reactions.find((item) => sameTopic(item) && item.usuario_id === currentUserId);
    return {
        respostas: replies.filter(sameTopic).length,
        gostei: reactions.filter((item) => sameTopic(item) && item.reacao === 'gostei').length,
        nao_gostei: reactions.filter((item) => sameTopic(item) && item.reacao === 'nao_gostei').length,
        minha_reacao: own?.reacao || null,
    };
}

async function topicDetail(id, user) {
    const [{ data: topic, error }, { data: replies, error: repliesError }, { data: reactions, error: reactionsError }] = await Promise.all([
        db().from('topicos_comunidade').select('id,autor_id,titulo,conteudo,categoria,fechado,criado_em,atualizado_em,usuarios:autor_id(nome,perfil)').eq('id', id).maybeSingle(),
        db().from('topico_respostas').select('id,topico_id,autor_id,conteudo,criado_em,usuarios:autor_id(nome,perfil)').eq('topico_id', id).order('criado_em').limit(300),
        db().from('topico_reacoes').select('topico_id,usuario_id,reacao').eq('topico_id', id),
    ]);
    if (error || repliesError || reactionsError) throw error || repliesError || reactionsError;
    return {
        topico: publicTopic(topic, user, metricsFor(id, replies || [], reactions || [], user.id)),
        respostas: (replies || []).map((reply) => publicReply(reply, user.id)),
    };
}

async function requireManageableTopic(id, user) {
    const { data: topic, error } = await db().from('topicos_comunidade')
        .select('id,autor_id,titulo,conteudo,categoria,fechado').eq('id', id).maybeSingle();
    if (error || !topic) return { response: json(404, { erro: 'Tópico não encontrado.' }) };
    if (!canManage(topic, user)) return { response: json(403, { erro: 'Você não pode alterar este tópico.' }) };
    return { topic };
}

export const handler = async (event) => {
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(event.httpMethod)) return json(405, { erro: 'Método não permitido.' });
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
            if (params.id) return json(200, await topicDetail(params.id, user));

            const { data, error } = await db().from('topicos_comunidade')
                .select('id,autor_id,titulo,conteudo,categoria,fechado,criado_em,atualizado_em,usuarios:autor_id(nome,perfil)')
                .order('atualizado_em', { ascending: false }).limit(80);
            if (error) throw error;
            const topics = data || [];
            const ids = topics.map((topic) => topic.id);
            let replies = [];
            let reactions = [];
            if (ids.length) {
                const [replyResult, reactionResult] = await Promise.all([
                    db().from('topico_respostas').select('topico_id').in('topico_id', ids).limit(5000),
                    db().from('topico_reacoes').select('topico_id,usuario_id,reacao').in('topico_id', ids).limit(5000),
                ]);
                if (replyResult.error || reactionResult.error) throw replyResult.error || reactionResult.error;
                replies = replyResult.data || [];
                reactions = reactionResult.data || [];
            }
            return json(200, {
                topicos: topics.map((topic) => publicTopic(topic, user, metricsFor(topic.id, replies, reactions, user.id))),
            });
        }

        if (event.httpMethod === 'POST') {
            const body = parseBody(event);
            const action = ['responder', 'reagir'].includes(body.action) ? body.action : 'criar';
            const limits = { criar: 6, responder: 30, reagir: 120 };
            const rate = await consumeRateLimit(event, `topico-${action}`, { limit: limits[action], windowSeconds: 3600 }, user.id);
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

            if (action === 'reagir') {
                if (!body.topico_id || !REACTIONS.has(body.reacao)) return json(400, { erro: 'Reação inválida.' });
                const { data: topic } = await db().from('topicos_comunidade').select('id').eq('id', body.topico_id).maybeSingle();
                if (!topic) return json(404, { erro: 'Tópico não encontrado.' });
                const { data: current, error: currentError } = await db().from('topico_reacoes')
                    .select('reacao').eq('topico_id', topic.id).eq('usuario_id', user.id).maybeSingle();
                if (currentError) throw currentError;
                if (current?.reacao === body.reacao) {
                    const { error } = await db().from('topico_reacoes').delete().eq('topico_id', topic.id).eq('usuario_id', user.id);
                    if (error) throw error;
                } else {
                    const { error } = await db().from('topico_reacoes').upsert({
                        topico_id: topic.id, usuario_id: user.id, reacao: body.reacao, atualizado_em: new Date().toISOString(),
                    }, { onConflict: 'topico_id,usuario_id' });
                    if (error) throw error;
                }
                return json(200, await topicDetail(topic.id, user));
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
            const result = await requireManageableTopic(body.id, user);
            if (result.response) return result.response;
            const topic = result.topic;

            if (body.action === 'editar') {
                const titulo = cleanText(body.titulo, 90);
                const conteudo = cleanText(body.conteudo, 2400);
                const categoria = CATEGORIES.has(body.categoria) ? body.categoria : topic.categoria;
                if (categoria === 'aviso' && user.perfil !== 'supremo') return json(403, { erro: 'Somente o Desenvolvedor pode publicar avisos.' });
                if (graphemeLength(titulo) < 5 || graphemeLength(titulo) > 90 || graphemeLength(conteudo) < 5 || graphemeLength(conteudo) > 2400) {
                    return json(400, { erro: 'Informe um título e uma descrição mais completos.' });
                }
                const { error } = await db().from('topicos_comunidade').update({
                    titulo, conteudo, categoria, atualizado_em: new Date().toISOString(),
                }).eq('id', topic.id);
                if (error) throw error;
                return json(200, { ok: true });
            }

            const { error } = await db().from('topicos_comunidade')
                .update({ fechado: Boolean(body.fechado), atualizado_em: new Date().toISOString() }).eq('id', topic.id);
            if (error) throw error;
            return json(200, { ok: true });
        }

        if (event.httpMethod === 'DELETE') {
            const body = parseBody(event);
            const result = await requireManageableTopic(body.id, user);
            if (result.response) return result.response;
            const { error } = await db().from('topicos_comunidade').delete().eq('id', result.topic.id);
            if (error) throw error;
            return json(200, { ok: true });
        }

        return json(405, { erro: 'Método não permitido.' });
    } catch (error) {
        console.error('Falha nos tópicos:', error.message);
        return json(400, { erro: 'Não foi possível concluir a operação nos tópicos.' });
    }
};
