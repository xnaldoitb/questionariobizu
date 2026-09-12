import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { cleanText, graphemeLength } from '../platform/community-access.mjs';
import { createNotifications } from '../platform/notifications.mjs';

const SUPPORT_LIST_LIMIT = 100;

async function findOwnConversation(user) {
    const { data, error } = await db().from('suporte_conversas')
        .select('id,usuario_id,status,atualizado_em,criado_em,usuarios:usuario_id(id,nome,usuario)')
        .eq('usuario_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
}

async function ensureOwnConversation(user) {
    const { data, error } = await db().from('suporte_conversas')
        .upsert({ usuario_id: user.id }, { onConflict: 'usuario_id', ignoreDuplicates: false })
        .select('id,usuario_id,status,atualizado_em,criado_em,usuarios:usuario_id(id,nome,usuario)').single();
    if (error) throw error;
    return data;
}

async function conversationFor(user, requestedId, { create = false } = {}) {
    if (user.perfil !== 'supremo') {
        return create ? ensureOwnConversation(user) : findOwnConversation(user);
    }
    const id = String(requestedId || '').trim();
    if (!id) return null;
    const { data, error } = await db().from('suporte_conversas')
        .select('id,usuario_id,status,atualizado_em,criado_em,usuarios:usuario_id(id,nome,usuario)')
        .eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

function publicConversation(record) {
    if (!record) return null;
    const { usuarios, nome, usuario, ...conversation } = record;
    const owner = usuarios || (nome || usuario ? { nome, usuario } : null);
    return { ...conversation, usuario: owner };
}

function directoryConversation(record) {
    return {
        id: record.id,
        usuario_id: record.usuario_id,
        status: record.status,
        atualizado_em: record.atualizado_em,
        criado_em: record.criado_em,
        ultima_mensagem: record.ultima_mensagem || '',
        ultima_mensagem_em: record.ultima_mensagem_em || record.atualizado_em,
        usuarios: {
            nome: record.nome || record.usuarios?.nome || 'Aluno',
            usuario: record.usuario || record.usuarios?.usuario || '',
        },
    };
}

async function listConversations() {
    const { data, error } = await db().rpc('listar_suporte_conversas_v4481', {
        p_limite: SUPPORT_LIST_LIMIT,
    });
    if (!error) return (data || []).map(directoryConversation);

    // Compatibilidade enquanto a migração v4.48.1 ainda não foi executada.
    if (!['PGRST202', '42883'].includes(error.code)) throw error;
    const fallback = await db().from('suporte_conversas')
        .select('id,usuario_id,status,atualizado_em,criado_em,usuarios:usuario_id(nome,usuario)')
        .order('atualizado_em', { ascending: false }).limit(SUPPORT_LIST_LIMIT);
    if (fallback.error) throw fallback.error;
    return (fallback.data || []).map(directoryConversation);
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
                const conversations = await listConversations();
                const requestedId = String(params.conversa_id || '').trim();
                let conversation = requestedId
                    ? conversations.find((item) => item.id === requestedId) || null
                    : conversations[0] || null;
                if (requestedId && !conversation) {
                    conversation = await conversationFor(user, requestedId);
                }
                return json(200, {
                    conversas: conversations,
                    conversa: publicConversation(conversation),
                    mensagens: conversation ? await messages(conversation.id, user.id) : [],
                });
            }
            const conversation = await conversationFor(user, params.conversa_id);
            if (!conversation) return json(200, { conversa: null, mensagens: [] });
            return json(200, {
                conversa: publicConversation(conversation),
                mensagens: await messages(conversation.id, user.id),
            });
        }

        if (event.httpMethod === 'POST') {
            const body = parseBody(event);
            const content = cleanText(body.mensagem, 1000);
            if (!content || graphemeLength(content) > 1000) return json(400, { erro: 'A mensagem deve ter entre 1 e 1000 caracteres.' });
            const rate = await consumeRateLimit(event, 'suporte-mensagem', { limit: 30, windowSeconds: 60 }, user.id);
            if (!rate.allowed) return json(429, { erro: 'Muitas mensagens em sequência. Aguarde um instante.' });
            const conversation = await conversationFor(user, body.conversa_id, { create: true });
            if (!conversation) return json(404, { erro: 'Conversa de suporte não encontrada.' });

            const { data: savedMessage, error } = await db().from('suporte_mensagens').insert({
                conversa_id: conversation.id,
                autor_id: user.id,
                mensagem: content,
            }).select('id').single();
            if (error) throw error;
            await db().from('suporte_conversas').update({ status: 'aberta', atualizado_em: new Date().toISOString() }).eq('id', conversation.id);
            let recipients = [];
            if (user.perfil === 'supremo') {
                recipients = [conversation.usuario_id];
            } else {
                const { data: developers } = await db().from('usuarios').select('id').eq('perfil', 'supremo').eq('ativo', true);
                recipients = (developers || []).map((developer) => developer.id);
            }
            await createNotifications(recipients.filter((id) => id !== user.id).map((id) => ({
                usuario_id: id,
                tipo: 'suporte',
                titulo: 'Nova mensagem no suporte',
                mensagem: user.perfil === 'supremo' ? 'O Desenvolvedor respondeu ao seu atendimento.' : `${user.nome} enviou uma mensagem ao suporte.`,
                acao: 'suporte',
                referencia_id: conversation.id,
                chave: `suporte:${savedMessage.id}:${id}`,
            }))).catch((notificationError) => console.error('Falha ao notificar suporte:', notificationError.message));
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
