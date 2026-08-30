import { db } from './db.mjs';

import { resolveQuestionAccess } from './access-policy.mjs';
export { resolveQuestionAccess } from './access-policy.mjs';

export async function loadQuestionAccess(userId) {
    const { data, error } = await db()
        .from('usuarios')
        .select('id,perfil,vip,validade_ate,acesso_teste,teste_ciclo_em,teste_saldo_segundos,teste_ativo_ate')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    return resolveQuestionAccess(data);
}

export function questionAccessDeniedResponse(access) {
    return {
        erro: access?.mensagem || 'Acesso às questões indisponível.',
        codigo: access?.codigo || 'ACESSO_QUESTOES_BLOQUEADO',
        acesso: access || null,
    };
}
