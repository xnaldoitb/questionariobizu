import { handler as login } from '../server/routes/login.mjs';
import { handler as logout } from '../server/routes/logout.mjs';
import { handler as cadastro } from '../server/routes/cadastro.mjs';
import { handler as me } from '../server/routes/me.mjs';
import { handler as catalogo } from '../server/routes/catalogo.mjs';
import { handler as questoes } from '../server/routes/questoes.mjs';
import { handler as responder } from '../server/routes/responder.mjs';
import { handler as sessoes } from '../server/routes/sessoes.mjs';
import { handler as ranking } from '../server/routes/ranking.mjs';
import { handler as adminUsers } from '../server/routes/admin-users.mjs';
import { handler as adminCatalogo } from '../server/routes/admin-catalogo.mjs';
import { handler as adminQuestions } from '../server/routes/admin-questions.mjs';
import { handler as adminImport } from '../server/routes/admin-import.mjs';
import { handler as adminExport } from '../server/routes/admin-export.mjs';
import { handler as adminBackup } from '../server/routes/admin-backup.mjs';
import { handler as adminMaintenance } from '../server/routes/admin-maintenance.mjs';
import {
    sendNetlifyResult,
    toNetlifyEvent,
} from '../server/platform/vercel-adapter.mjs';

const routes = new Map([
    ['login', login],
    ['logout', logout],
    ['cadastro', cadastro],
    ['me', me],
    ['catalogo', catalogo],
    ['questoes', questoes],
    ['responder', responder],
    ['sessoes', sessoes],
    ['ranking', ranking],
    ['admin-users', adminUsers],
    ['admin-catalogo', adminCatalogo],
    ['admin-questions', adminQuestions],
    ['admin-import', adminImport],
    ['admin-export', adminExport],
    ['admin-backup', adminBackup],
    ['admin-maintenance', adminMaintenance],
]);

function getRouteName(req) {
    const routeFromQuery = req.query?.route;

    if (Array.isArray(routeFromQuery)) {
        return routeFromQuery.filter(Boolean).join('/');
    }

    if (typeof routeFromQuery === 'string' && routeFromQuery.trim()) {
        return routeFromQuery.replace(/^\/+|\/+$/g, '');
    }

    const pathname = new URL(req.url, 'http://localhost').pathname;
    return pathname.replace(/^\/api\/?/, '').replace(/\/+$/g, '');
}

export default async function apiRouter(req, res) {
    const routeName = getRouteName(req);
    const handler = routes.get(routeName);

    if (!handler) {
        return res.status(404).json({
            erro: 'Rota de API não encontrada.',
            rota: routeName || null,
        });
    }

    try {
        const event = toNetlifyEvent(req);
        event.queryStringParameters = { ...event.queryStringParameters };
        delete event.queryStringParameters.route;

        const result = await handler(event);
        return sendNetlifyResult(res, result);
    } catch (error) {
        console.error(`Erro não tratado em /api/${routeName}:`, error);
        return res.status(500).json({
            erro: error?.message || 'Erro interno do servidor.',
        });
    }
}
