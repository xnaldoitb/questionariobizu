import { getUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';
import { loadPlans } from '../platform/payments.mjs';

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') return json(405, { erro: 'Método não permitido.' });
    const user = await getUser(event);
    if (!user) return json(401, { erro: 'Não autenticado.' });
    return json(200, { planos: await loadPlans() });
};
