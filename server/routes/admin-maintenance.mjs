import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';

async function deleteAllRows(table, column) {
    const { error, count } = await db()
        .from(table)
        .delete({ count: 'exact' })
        .not(column, 'is', null);

    if (error) throw error;
    return count || 0;
}

export const handler = async (event) => {
    if (!(await requireUser(event, 'supremo'))) {
        return json(403, { erro: 'Acesso restrito.' });
    }

    if (event.httpMethod !== 'POST') {
        return json(405, { erro: 'Método não permitido.' });
    }

    const body = parseBody(event);
    const action = String(body.action || '');

    try {
        if (action === 'clear_results') {
            const required = 'LIMPAR TODOS OS RESULTADOS';
            if (String(body.confirmacao || '').trim().toUpperCase() !== required) {
                return json(400, { erro: `Confirmação inválida. Digite exatamente: ${required}` });
            }

            const respostas = await deleteAllRows('respostas', 'id');
            const sessoes = await deleteAllRows('sessoes', 'id');

            return json(200, { ok: true, removidos: { respostas, sessoes } });
        }

        if (action === 'end_student_sessions') {
            const { error, count } = await db()
                .from('usuarios')
                .update(
                    { sessao_ativa_id: null, sessao_ativa_expira_em: null },
                    { count: 'exact' },
                )
                .eq('perfil', 'aluno')
                .not('sessao_ativa_id', 'is', null);

            if (error) throw error;
            return json(200, { ok: true, sessoes_encerradas: count || 0 });
        }

        return json(400, { erro: 'Ação de manutenção inválida.' });
    } catch (error) {
        return json(400, { erro: error.message });
    }
};
