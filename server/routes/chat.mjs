import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { cleanupCommunity, listActiveUsers, touchPresence } from '../platform/community.mjs';
import { cleanText, graphemeLength, roomForUser } from '../platform/community-access.mjs';
import { createNotifications } from '../platform/notifications.mjs';

const MAX_MESSAGE_LENGTH = 400;
const MESSAGE_LIMIT = 80;

async function loadMessages(roomId, currentUserId) {
    const { data, error } = await db().from('chat_mensagens')
        .select('id,mensagem,criado_em,usuario_id,usuarios(nome,perfil,vip,premium,plano_atual)')
        .eq('sala_id', roomId).order('id', { ascending: false }).limit(MESSAGE_LIMIT);
    if (error) throw error;

    return (data || []).reverse().map((row) => ({
        id: row.id,
        mensagem: row.mensagem,
        criado_em: row.criado_em,
        propria: row.usuario_id === currentUserId,
        usuario: {
            nome: row.usuarios?.nome || 'Usuário',
            perfil: row.usuarios?.perfil || 'aluno',
            vip: Boolean(row.usuarios?.vip),
            premium: Boolean(row.usuarios?.premium),
            plano_atual: row.usuarios?.plano_atual || null,
        },
    }));
}

export const handler = async (event) => {
    if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    try {
        const body = event.httpMethod === 'POST' ? parseBody(event) : {};
        const roomId = body.sala_id || event.queryStringParameters?.sala;
        const room = await roomForUser(user, roomId);
        if (!room) return json(403, { erro: 'Sala indisponível ou sem permissão de acesso.' });

        if (event.httpMethod === 'GET') {
            const rate = await consumeRateLimit(event, 'chat-leitura', {
                limit: 15, windowSeconds: 60, includeIp: false, failClosed: true,
            }, user.id);
            if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
                erro: 'Muitas atualizações do chat. Aguarde alguns segundos.',
            }, { 'retry-after': '60' });
            await cleanupCommunity();
            const [messages, active] = await Promise.all([loadMessages(room.id, user.id), listActiveUsers()]);
            return json(200, { sala: room, mensagens: messages, online: active.count });
        }

        if (event.httpMethod === 'POST') {
            const rate = await consumeRateLimit(event, 'chat-sala', { limit: 24, windowSeconds: 60 }, user.id);
            if (!rate.allowed) return json(429, { erro: 'Você enviou muitas mensagens. Aguarde alguns segundos.' }, { 'retry-after': '60' });

            const message = cleanText(body.mensagem, MAX_MESSAGE_LENGTH);
            if (!message) return json(400, { erro: 'Digite uma mensagem.' });
            if (graphemeLength(message) > MAX_MESSAGE_LENGTH) {
                return json(400, { erro: `A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.` });
            }

            await cleanupCommunity();
            await touchPresence(user.id, { activity: true });
            const { data, error } = await db().from('chat_mensagens')
                .insert({ sala_id: room.id, usuario_id: user.id, mensagem: message })
                .select('id,mensagem,criado_em').single();
            if (error) throw error;

            if (room.tipo === 'privada') {
                const { data: members, error: memberError } = await db().from('chat_sala_membros')
                    .select('usuario_id').eq('sala_id', room.id).neq('usuario_id', user.id);
                if (!memberError) {
                    await createNotifications((members || []).map((member) => ({
                        usuario_id: member.usuario_id,
                        tipo: 'chat_privado',
                        titulo: `Nova mensagem em ${room.nome}`,
                        mensagem: `${user.nome}: ${message}`,
                        acao: 'chat',
                        referencia_id: room.id,
                        chave: `chat:${data.id}:${member.usuario_id}`,
                    }))).catch((notificationError) => console.error('Falha ao notificar chat privado:', notificationError.message));
                }
            }

            return json(201, {
                mensagem: {
                    id: data.id,
                    mensagem: data.mensagem,
                    criado_em: data.criado_em,
                    propria: true,
                    usuario: {
                        nome: user.nome,
                        perfil: user.perfil,
                        vip: Boolean(user.vip),
                        premium: Boolean(user.premium),
                        plano_atual: user.plano_atual || null,
                    },
                },
            });
        }

        return json(405, { erro: 'Método não permitido.' });
    } catch (error) {
        console.error('Falha interna no chat:', error.message);
        return json(500, { erro: 'Não foi possível concluir a operação no chat.' });
    }
};
