import { json, parseBody } from '../platform/http.mjs';
import { applyMercadoPagoPayment, mercadoPagoRequest, validateWebhookSignature } from '../platform/payments.mjs';

function notificationDataId(event, body) {
    return event.queryStringParameters?.['data.id'] || event.queryStringParameters?.data_id || body?.data?.id || null;
}

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { erro: 'Método não permitido.' });
    const body = parseBody(event);
    const dataId = notificationDataId(event, body);
    if (!validateWebhookSignature(event, dataId)) return json(401, { erro: 'Assinatura inválida.' });

    const type = String(body?.type || event.queryStringParameters?.type || event.queryStringParameters?.topic || '');
    if (type && type !== 'payment') return json(200, { ok: true, ignorado: true });

    const payment = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(dataId)}`);
    const resultado = await applyMercadoPagoPayment(payment);
    return json(200, { ok: true, resultado });
};
