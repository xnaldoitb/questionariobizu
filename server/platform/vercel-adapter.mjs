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

    if (!Object.keys(headers).some((name) => name.toLowerCase() === 'cache-control')) {
        res.setHeader('cache-control', 'no-store');
    }

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
                erro: 'Erro interno do servidor.',
            });
        }
    };
}
