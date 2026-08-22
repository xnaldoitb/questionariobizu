import { clearCookie, getUser } from '../platform/auth.mjs';
import { db } from '../platform/db.mjs';
import { json } from '../platform/http.mjs';

export const handler = async (event) => {
    try {
        const user = await getUser(event);

        if (user?.perfil === 'aluno' && user.sessao_id) {
            await db()
                .from('usuarios')
                .update({ sessao_ativa_id: null, sessao_ativa_expira_em: null })
                .eq('id', user.id)
                .eq('sessao_ativa_id', user.sessao_id);
        }
    } catch {
        // O logout deve sempre limpar o cookie mesmo que o banco esteja indisponivel.
    }

    return json(200, { ok: true }, { 'set-cookie': clearCookie });
};
