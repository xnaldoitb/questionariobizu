import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { cleanText, GENERAL_ROOM_ID } from '../platform/community-access.mjs';
import { createNotifications } from '../platform/notifications.mjs';

function publicRoom(room, userId, member = false) {
    return {
        id: room.id,
        nome: room.nome,
        tipo: room.tipo,
        sistema: Boolean(room.sistema),
        criador: Boolean(room.criador_id && room.criador_id === userId),
        membro: member || room.tipo === 'publica',
        criado_em: room.criado_em,
    };
}

async function listRooms(user) {
    const client = db();
    const [{ data: publicRooms, error: publicError }, { data: memberships, error: memberError }] = await Promise.all([
        client.from('chat_salas').select('id,nome,tipo,criador_id,sistema,ativa,criado_em')
            .eq('tipo', 'publica').eq('ativa', true).order('sistema', { ascending: false }).order('criado_em'),
        client.from('chat_sala_membros').select('sala_id').eq('usuario_id', user.id),
    ]);
    if (publicError || memberError) throw publicError || memberError;

    const memberIds = [...new Set((memberships || []).map((item) => item.sala_id))];
    let privateRooms = [];
    if (memberIds.length) {
        const { data, error } = await client.from('chat_salas')
            .select('id,nome,tipo,criador_id,sistema,ativa,criado_em')
            .in('id', memberIds).eq('tipo', 'privada').eq('ativa', true).order('criado_em');
        if (error) throw error;
        privateRooms = data || [];
    }

    const memberSet = new Set(memberIds);
    const rooms = [...(publicRooms || []), ...privateRooms]
        .map((room) => publicRoom(room, user.id, memberSet.has(room.id)));
    rooms.sort((a, b) => Number(b.id === GENERAL_ROOM_ID) - Number(a.id === GENERAL_ROOM_ID));
    return rooms;
}

async function resolvePrivateMembers(logins) {
    const values = [...new Set((Array.isArray(logins) ? logins : String(logins || '').split(','))
        .map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
    if (values.length > 20) throw new Error('Uma sala privada aceita até 20 participantes.');
    if (!values.length) return [];

    const { data, error } = await db().from('usuarios')
        .select('id,usuario,nome').in('usuario', values).eq('ativo', true).eq('status_aprovacao', 'aprovado');
    if (error) throw error;
    const found = data || [];
    const foundLogins = new Set(found.map((user) => user.usuario));
    const missing = values.filter((value) => !foundLogins.has(value));
    if (missing.length) throw new Error('PARTICIPANTES_INVALIDOS');
    return found;
}

export const handler = async (event) => {
    if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    try {
        if (event.httpMethod === 'GET') {
            const rate = await consumeRateLimit(event, 'chat-salas-leitura', {
                limit: 20, windowSeconds: 60, includeIp: false, failClosed: true,
            }, user.id);
            if (!rate.allowed) return json(rate.unavailable ? 503 : 429, {
                erro: 'Muitas atualizações das salas. Aguarde um minuto.',
            }, { 'retry-after': '60' });
            return json(200, { salas: await listRooms(user) });
        }

        if (event.httpMethod === 'POST') {
            const rate = await consumeRateLimit(event, 'chat-criar-sala', { limit: 5, windowSeconds: 3600 }, user.id);
            if (!rate.allowed) return json(429, { erro: 'Limite de criação de salas atingido. Tente novamente mais tarde.' });

            const body = parseBody(event);
            const nome = cleanText(body.nome, 50);
            const tipo = body.tipo === 'privada' ? 'privada' : 'publica';
            if (nome.length < 3 || nome.length > 50) return json(400, { erro: 'O nome da sala deve ter entre 3 e 50 caracteres.' });
            let members = [];
            if (tipo === 'privada') {
                try {
                    members = await resolvePrivateMembers(body.participantes);
                } catch (error) {
                    if (error.message === 'PARTICIPANTES_INVALIDOS') {
                        return json(400, {
                            erro: 'Não foi possível adicionar um ou mais participantes. Confira os números informados.',
                        });
                    }
                    throw error;
                }
            }

            const { data: room, error } = await db().from('chat_salas')
                .insert({ nome, tipo, criador_id: user.id }).select('id,nome,tipo,criador_id,sistema,ativa,criado_em').single();
            if (error) throw error;

            const memberships = [
                { sala_id: room.id, usuario_id: user.id, papel: 'criador' },
                ...members.filter((member) => member.id !== user.id)
                    .map((member) => ({ sala_id: room.id, usuario_id: member.id, papel: 'membro' })),
            ];
            const { error: membershipError } = await db().from('chat_sala_membros').insert(memberships);
            if (membershipError) {
                await db().from('chat_salas').delete().eq('id', room.id).eq('criador_id', user.id);
                throw membershipError;
            }

            if (tipo === 'privada') {
                await createNotifications(members.filter((member) => member.id !== user.id).map((member) => ({
                    usuario_id: member.id,
                    tipo: 'chat_privado',
                    titulo: 'Convite para sala privada',
                    mensagem: `${user.nome} adicionou você à sala ${nome}.`,
                    acao: 'chat',
                    referencia_id: room.id,
                    chave: `sala-convite:${room.id}:${member.id}`,
                }))).catch((notificationError) => console.error('Falha ao notificar convite:', notificationError.message));
            }

            return json(201, { sala: publicRoom(room, user.id, true) });
        }

        return json(405, { erro: 'Método não permitido.' });
    } catch (error) {
        console.error('Falha nas salas do chat:', error.message);
        return json(400, { erro: 'Não foi possível concluir a operação nas salas.' });
    }
};
