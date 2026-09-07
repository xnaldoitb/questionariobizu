import { getUser } from '../platform/auth.mjs';
import { db } from '../platform/db.mjs';
import { json, parseBody } from '../platform/http.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const handler = async (event) => {
    const user = await getUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });

    if (event.httpMethod === 'GET') {
        const { data, error } = await db().from('premios_usuario')
            .select('id,plano,plano_nome,mensagem,criado_em')
            .eq('usuario_id', user.id)
            .is('visualizado_em', null)
            .order('criado_em', { ascending: true })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return json(200, { premio: data || null });
    }

    if (event.httpMethod === 'POST') {
        const body = parseBody(event);
        const premioId = String(body.premio_id || '');
        if (!UUID.test(premioId)) return json(400, { erro: 'Prêmio inválido.' });
        const { data, error } = await db().from('premios_usuario')
            .update({ visualizado_em: new Date().toISOString() })
            .eq('id', premioId)
            .eq('usuario_id', user.id)
            .is('visualizado_em', null)
            .select('id')
            .maybeSingle();
        if (error) throw error;
        return data ? json(200, { ok: true }) : json(404, { erro: 'Prêmio não encontrado ou já visualizado.' });
    }

    return json(405, { erro: 'Método não permitido.' });
};
