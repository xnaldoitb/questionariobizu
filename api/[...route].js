import { bodyLimitResponse } from '../server/platform/body-limits.mjs';
import { getRouteName } from '../server/platform/request-url.mjs';
import {
    sendNetlifyResult,
    toNetlifyEvent,
} from '../server/platform/vercel-adapter.mjs';

const routes = new Map([
    ['login', () => import('../server/routes/login.mjs')],
    ['logout', () => import('../server/routes/logout.mjs')],
    ['cadastro', () => import('../server/routes/cadastro.mjs')],
    ['me', () => import('../server/routes/me.mjs')],
    ['acesso-atividade', () => import('../server/routes/acesso-atividade.mjs')],
    ['catalogo', () => import('../server/routes/catalogo.mjs')],
    ['questoes', () => import('../server/routes/questoes.mjs')],
    ['responder', () => import('../server/routes/responder.mjs')],
    ['sessoes', () => import('../server/routes/sessoes.mjs')],
    ['ranking', () => import('../server/routes/ranking.mjs')],
    ['presenca', () => import('../server/routes/presenca.mjs')],
    ['chat', () => import('../server/routes/chat.mjs')],
    ['chat-salas', () => import('../server/routes/chat-salas.mjs')],
    ['suporte', () => import('../server/routes/suporte.mjs')],
    ['topicos', () => import('../server/routes/topicos.mjs')],
    ['premio', () => import('../server/routes/premio.mjs')],
    ['patente', () => import('../server/routes/patente.mjs')],
    ['missoes', () => import('../server/routes/missoes.mjs')],
    ['notificacoes', () => import('../server/routes/notificacoes.mjs')],
    ['pagamento-criar', () => import('../server/routes/pagamento-criar.mjs')],
    ['pagamento-status', () => import('../server/routes/pagamento-status.mjs')],
    ['pagamento-webhook', () => import('../server/routes/pagamento-webhook.mjs')],
    ['pagamentos-reconciliar', () => import('../server/routes/pagamentos-reconciliar.mjs')],
    ['planos', () => import('../server/routes/planos.mjs')],
    ['admin-users', () => import('../server/routes/admin-users.mjs')],
    ['admin-catalogo', () => import('../server/routes/admin-catalogo.mjs')],
    ['admin-questions', () => import('../server/routes/admin-questions.mjs')],
    ['admin-import', () => import('../server/routes/admin-import.mjs')],
    ['admin-export', () => import('../server/routes/admin-export.mjs')],
    ['admin-backup', () => import('../server/routes/admin-backup.mjs')],
    ['admin-maintenance', () => import('../server/routes/admin-maintenance.mjs')],
    ['admin-payments', () => import('../server/routes/admin-payments.mjs')],
]);

export function crossOriginMutation(req, routeName) {
    if (routeName === 'pagamento-webhook') return false;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(req.method || '').toUpperCase())) return false;
    const originHeader = String(req.headers?.origin || '').trim();
    const refererHeader = String(req.headers?.referer || '').trim();
    let requestOrigin = originHeader;
    if (!requestOrigin && refererHeader) {
        try { requestOrigin = new URL(refererHeader).origin; } catch { return true; }
    }
    if (!requestOrigin || requestOrigin === 'null') return true;

    let normalizedOrigin;
    try { normalizedOrigin = new URL(requestOrigin).origin; } catch { return true; }

    const configured = String(process.env.APP_URL || '').trim();
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').trim();
    const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const allowed = new Set();
    if (configured) {
        try { allowed.add(new URL(configured).origin); } catch { return true; }
    }
    if (host) {
        try { allowed.add(new URL(`${protocol}://${host}`).origin); } catch { return true; }
    }
    return !allowed.size || !allowed.has(normalizedOrigin);
}

export default async function apiRouter(req, res) {
    const routeName = getRouteName(req);
    const routeLoader = routes.get(routeName);

    if (!routeLoader) {
        return res.status(404).json({
            erro: 'Rota de API não encontrada.',
            rota: routeName || null,
        });
    }

    if (crossOriginMutation(req, routeName)) {
        return res.status(403).json({ erro: 'Origem da requisição não permitida.' });
    }

    try {
        const { handler } = await routeLoader();
        const event = toNetlifyEvent(req);
        const sizeError = bodyLimitResponse(routeName, event.httpMethod, event.body, event.headers);
        if (sizeError) return res.status(413).json(sizeError);
        event.queryStringParameters = { ...event.queryStringParameters };
        delete event.queryStringParameters.route;

        const result = await handler(event);
        return sendNetlifyResult(res, result);
    } catch (error) {
        console.error(`Erro não tratado em /api/${routeName}:`, error);
        return res.status(500).json({
            erro: 'Erro interno do servidor.',
        });
    }
}
