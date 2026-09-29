import { getUser } from '../platform/auth.mjs';
import { db } from '../platform/db.mjs';
import { json, parseBody } from '../platform/http.mjs';

export const handler = async event => {
    if (event.httpMethod !== 'POST') return json(405, { erro: 'Método não permitido.' });
    const user = await getUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    const { ativo = false } = parseBody(event);
    if (user.perfil === 'aluno' && user.sessao_id && ativo === true) {
        const { error: sessionError } = await db().from('sessoes_dispositivo')
            .update({ ultimo_acesso_em: new Date().toISOString() })
            .eq('id', user.sessao_id).eq('usuario_id', user.id);
        if (sessionError) throw sessionError;
    }
    if (!user.acesso_teste) return json(200, { usuario: user });
    const { error } = await db().rpc('atualizar_teste_ativo', { p_usuario_id: user.id, p_ativo: ativo === true });
    if (error) throw error;
    return json(200, { usuario: await getUser(event) });
};
