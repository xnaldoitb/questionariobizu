import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { cleanText, graphemeLength } from '../platform/community-access.mjs';

async function ownConversation(user) {
    const { data, error } = await db().from('suporte_conversas')
        .upsert({ usuario_id: user.id }, { onConflict: 'usuario_id', ignoreDuplicates: false })
        .select('id,usuario_id,status,atualizado_em,criado_em').single();
    if (error) throw error;
    return data;
}

async function conversationFor(user, requestedId) {
    if (user.perfil !== 'supremo') return ownConversation(user);
    const id = String(requestedId || '').trim();
    if (!id) return null;
    const { data, error } = await db().from('suporte_conversas')
        .select('id,usuario_id,status,atualizado_em,criado_em').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

async function publicConversation(record) {
    if (!record) return null;
    const { data: owner } = await db().from('usuarios').select('id,nome,usuario').eq('id', record.usuario_id).maybeSingle();
    return { ...record, usuario: owner || null };
}

async function messages(conversationId, currentUserId) {
    const { data, error } = await db().from('suporte_mensagens')
        .select('id,conversa_id,autor_id,mensagem,criado_em,usuarios:autor_id(nome,perfil)')
        .eq('conversa_id', conversationId).order('criado_em', { ascending: true }).limit(300);
    if (error) throw error;
    return (data || []).map((message) => ({
        id: message.id,
        conversa_id: message.conversa_id,
        mensagem: message.mensagem,
        criado_em: message.criado_em,
        propria: message.autor_id === currentUserId,
        usuarios: message.usuarios || null,
    }));
}

export const handler = async (event) => {
    if (!['GET', 'POST', 'PUT'].includes(event.httpMethod)) return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    const params = event.queryStringParameters || {};

    try {
        if (event.httpMethod === 'GET') {
            const rate = await consumeRateLimit(event, 'suporte-leitura', {
                limit: 15, windowSeconds: 60, includeIp: false, failClosed: true,
            }, user.id);
            if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
                erro: 'Muitas atualizações do suporte. Aguarde um minuto.',
            }, { 'retry-after': '60' });
            if (user.perfil === 'supremo' && params.listar === '1') {
                const { data, error } = await db().from('suporte_conversas')
                    .select('id,usuario_id,status,atualizado_em,criado_em,usuarios:usuario_id(nome,usuario)')
                    .order('atualizado_em', { ascending: false }).limit(100);
                if (error) throw error;
                return json(200, { conversas: data || [] });
            }
            const conversation = await conversationFor(user, params.conversa_id);
            if (!conversation) return json(200, { conversa: null, mensagens: [] });
            return json(200, {
                conversa: await publicConversation(conversation),
                mensagens: await messages(conversation.id, user.id),
            });
        }

        if (event.httpMethod === 'POST') {
            const body = parseBody(event);
            const content = cleanText(body.mensagem, 1000);
            if (!content || graphemeLength(content) > 1000) return json(400, { erro: 'A mensagem deve ter entre 1 e 1000 caracteres.' });
            const rate = await consumeRateLimit(event, 'suporte-mensagem', { limit: 30, windowSeconds: 60 }, user.id);
            if (!rate.allowed) return json(429, { erro: 'Muitas mensagens em sequência. Aguarde um instante.' });
            const conversation = await conversationFor(user, body.conversa_id);
            if (!conversation) return json(404, { erro: 'Conversa de suporte não encontrada.' });

            const { error } = await db().from('suporte_mensagens').insert({
                conversa_id: conversation.id,
                autor_id: user.id,
                mensagem: content,
            });
            if (error) throw error;
            await db().from('suporte_conversas').update({ status: 'aberta', atualizado_em: new Date().toISOString() }).eq('id', conversation.id);
            return json(201, { ok: true });
        }

        if (event.httpMethod === 'PUT' && user.perfil === 'supremo') {
            const body = parseBody(event);
            const status = body.status === 'fechada' ? 'fechada' : 'aberta';
            const { error } = await db().from('suporte_conversas').update({ status, atualizado_em: new Date().toISOString() }).eq('id', body.conversa_id);
            if (error) throw error;
            return json(200, { ok: true, status });
        }

        return json(405, { erro: 'Método não permitido.' });
    } catch (error) {
        console.error('Falha no suporte:', error.message);
        return json(400, { erro: 'Não foi possível concluir a operação de suporte.' });
    }
};
