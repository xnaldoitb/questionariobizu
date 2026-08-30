import { requestQuery } from './request-url.mjs';

export function toNetlifyEvent(req) {
    const body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {});

    return {
        httpMethod: req.method,
        headers: req.headers ?? {},
        body,
        queryStringParameters: requestQuery(req),
    };
}

export function sendNetlifyResult(res, result) {
    const statusCode = result?.statusCode ?? 200;
    const headers = result?.headers ?? {};

    for (const [name, value] of Object.entries(headers)) {
        if (value !== undefined && value !== null) {
            res.setHeader(name, value);
        }
    }

    res.status(statusCode).send(result?.body ?? '');
}

export function vercelHandler(handler) {
    return async function route(req, res) {
        try {
            const result = await handler(toNetlifyEvent(req));
            sendNetlifyResult(res, result);
        } catch (error) {
            console.error('Erro não tratado na API:', error);
            res.status(500).json({
                erro: error?.message || 'Erro interno do servidor.',
            });
        }
    };
}
