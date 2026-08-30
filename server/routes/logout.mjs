import { clearCookie, getUser } from '../platform/auth.mjs';
import { db } from '../platform/db.mjs';
import { json } from '../platform/http.mjs';
import { cleanupCommunity, removePresence } from '../platform/community.mjs';

export const handler = async (event) => {
    try {
        const user = await getUser(event);

        if (user?.id) {
            await db().rpc('atualizar_teste_ativo', { p_usuario_id: user.id, p_ativo: false });
            await removePresence(user.id);
        }

        if (user?.perfil === 'aluno' && user.sessao_id) {
            await db().from('sessoes_dispositivo').delete().eq('usuario_id', user.id).eq('id', user.sessao_id);
        }

        await cleanupCommunity();
    } catch {
        // O logout deve sempre limpar o cookie mesmo que o banco esteja indisponivel.
    }

    return json(200, { ok: true }, { 'set-cookie': clearCookie });
};
