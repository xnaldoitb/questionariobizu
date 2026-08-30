import { handler as login } from '../server/routes/login.mjs';
import { bodyLimitResponse } from '../server/platform/body-limits.mjs';
import { getRouteName } from '../server/platform/request-url.mjs';
import { handler as logout } from '../server/routes/logout.mjs';
import { handler as cadastro } from '../server/routes/cadastro.mjs';
import { handler as me } from '../server/routes/me.mjs';
import { handler as acessoAtividade } from '../server/routes/acesso-atividade.mjs';
import { handler as catalogo } from '../server/routes/catalogo.mjs';
import { handler as questoes } from '../server/routes/questoes.mjs';
import { handler as responder } from '../server/routes/responder.mjs';
import { handler as sessoes } from '../server/routes/sessoes.mjs';
import { handler as ranking } from '../server/routes/ranking.mjs';
import { handler as presenca } from '../server/routes/presenca.mjs';
import { handler as chat } from '../server/routes/chat.mjs';
import { handler as pagamentoCriar } from '../server/routes/pagamento-criar.mjs';
import { handler as pagamentoStatus } from '../server/routes/pagamento-status.mjs';
import { handler as pagamentoWebhook } from '../server/routes/pagamento-webhook.mjs';
import { handler as pagamentosReconciliar } from '../server/routes/pagamentos-reconciliar.mjs';
import { handler as adminUsers } from '../server/routes/admin-users.mjs';
import { handler as adminCatalogo } from '../server/routes/admin-catalogo.mjs';
import { handler as adminQuestions } from '../server/routes/admin-questions.mjs';
import { handler as adminImport } from '../server/routes/admin-import.mjs';
import { handler as adminExport } from '../server/routes/admin-export.mjs';
import { handler as adminBackup } from '../server/routes/admin-backup.mjs';
import { handler as adminMaintenance } from '../server/routes/admin-maintenance.mjs';
import { handler as planos } from '../server/routes/planos.mjs';
import { handler as adminPayments } from '../server/routes/admin-payments.mjs';
import {
    sendNetlifyResult,
    toNetlifyEvent,
} from '../server/platform/vercel-adapter.mjs';

const routes = new Map([
    ['login', login],
    ['logout', logout],
    ['cadastro', cadastro],
    ['me', me],
    ['acesso-atividade', acessoAtividade],
    ['catalogo', catalogo],
    ['questoes', questoes],
    ['responder', responder],
    ['sessoes', sessoes],
    ['ranking', ranking],
    ['presenca', presenca],
    ['chat', chat],
    ['pagamento-criar', pagamentoCriar],
    ['pagamento-status', pagamentoStatus],
    ['pagamento-webhook', pagamentoWebhook],
    ['pagamentos-reconciliar', pagamentosReconciliar],
    ['planos', planos],
    ['admin-users', adminUsers],
    ['admin-catalogo', adminCatalogo],
    ['admin-questions', adminQuestions],
    ['admin-import', adminImport],
    ['admin-export', adminExport],
    ['admin-backup', adminBackup],
    ['admin-maintenance', adminMaintenance],
    ['admin-payments', adminPayments],
]);

function crossOriginMutation(req, routeName) {
    if (routeName === 'pagamento-webhook') return false;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(req.method || '').toUpperCase())) return false;
    const origin = String(req.headers?.origin || '').trim();
    if (!origin) return false;
    const configured = String(process.env.APP_URL || '').trim().replace(/\/$/, '');
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').trim();
    const expected = configured || (host ? `https://${host}` : '');
    return !expected || origin !== expected;
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

    if (crossOriginMutation(req, routeName)) {
        return res.status(403).json({ erro: 'Origem da requisição não permitida.' });
    }

    try {
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
