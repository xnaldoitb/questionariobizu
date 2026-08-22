import { db } from './db.mjs';

function clientIp(event) {
    const headers = event.headers || {};
    const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
    return String(forwarded).split(',')[0].trim()
        || headers['x-real-ip']
        || headers['X-Real-Ip']
        || 'unknown';
}

export async function consumeRateLimit(event, scope, { limit, windowSeconds }, subject = '') {
    const key = `${clientIp(event)}:${String(subject).trim().toLowerCase()}`.slice(0, 300);
    const { data, error } = await db().rpc('consume_rate_limit', {
        p_scope: scope,
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
    });

    if (error) {
        console.error('Falha no rate limit:', error);
        // Fail open: indisponibilidade do limitador nao derruba o login/cadastro.
        return { allowed: true, remaining: null };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
        allowed: result?.allowed !== false,
        remaining: Number.isFinite(Number(result?.remaining)) ? Number(result.remaining) : null,
    };
}
