import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import {
    cleanupCommunity,
    listActiveUsers,
    touchPresence,
} from '../platform/community.mjs';

const MAX_MESSAGE_LENGTH = 400;
const MESSAGE_LIMIT = 60;

function messageLength(value) {
    if (globalThis.Intl?.Segmenter) {
        return [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(value)].length;
    }
    return Array.from(value).length;
}

function normalizeMessage(value) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/[\t ]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function loadMessages() {
    const { data, error } = await db()
        .from('chat_temporario')
        .select('id,mensagem,criado_em,usuario_id,usuarios(nome,perfil,vip)')
        .order('id', { ascending: false })
        .limit(MESSAGE_LIMIT);

    if (error) throw error;

    return (data || []).reverse().map((row) => ({
        id: row.id,
        mensagem: row.mensagem,
        criado_em: row.criado_em,
        usuario_id: row.usuario_id,
        usuario: {
            nome: row.usuarios?.nome || 'Usuário',
            perfil: row.usuarios?.perfil || 'aluno',
            vip: Boolean(row.usuarios?.vip),
        },
    }));
}

export const handler = async (event) => {
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    try {
        if (event.httpMethod === 'GET') {
            await cleanupCommunity();
            const [messages, active] = await Promise.all([
                loadMessages(),
                listActiveUsers(),
            ]);

            return json(200, {
                mensagens: messages,
                online: active.count,
            });
        }

        if (event.httpMethod === 'POST') {
            const rate = await consumeRateLimit(
                event,
                'chat-temporario',
                { limit: 20, windowSeconds: 60 },
                user.id,
            );

            if (!rate.allowed) {
                return json(429, {
                    erro: 'Você enviou muitas mensagens em pouco tempo. Aguarde alguns segundos.',
                }, { 'retry-after': '60' });
            }

            const message = normalizeMessage(parseBody(event).mensagem);
            if (!message) return json(400, { erro: 'Digite uma mensagem.' });
            if (messageLength(message) > MAX_MESSAGE_LENGTH) {
                return json(400, { erro: `A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.` });
            }

            // Enviar mensagem é atividade real e reativa a presença do usuário.
            await cleanupCommunity();
            await touchPresence(user.id, { activity: true });

            const { data, error } = await db()
                .from('chat_temporario')
                .insert({ usuario_id: user.id, mensagem: message })
                .select('id,mensagem,criado_em,usuario_id')
                .single();

            if (error) throw error;

            return json(201, {
                mensagem: {
                    ...data,
                    usuario: {
                        nome: user.nome,
                        perfil: user.perfil,
                        vip: Boolean(user.vip),
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
