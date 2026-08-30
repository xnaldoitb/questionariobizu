import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import {
    cleanupCommunity,
    listActiveUsers,
    removePresence,
    touchPresence,
} from '../platform/community.mjs';

async function snapshot() {
    await cleanupCommunity();
    const active = await listActiveUsers();
    return {
        online: active.count,
        usuarios: active.users,
    };
}

export const handler = async (event) => {
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    try {
        if (event.httpMethod === 'GET') {
            return json(200, await snapshot());
        }

        if (event.httpMethod === 'POST') {
            // Limpa primeiro para que uma sala realmente vazia descarte o chat anterior.
            await cleanupCommunity();
            const { atividade = false } = parseBody(event);
            await touchPresence(user.id, { activity: Boolean(atividade) });
            const active = await listActiveUsers();
            return json(200, { online: active.count, usuarios: active.users });
        }

        if (event.httpMethod === 'DELETE') {
            await removePresence(user.id);
            return json(200, await snapshot());
        }

        return json(405, { erro: 'Método não permitido.' });
    } catch (error) {
        console.error('Falha interna na presença:', error.message);
        return json(500, { erro: 'Não foi possível atualizar a presença.' });
    }
};
