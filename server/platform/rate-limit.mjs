import { db } from './db.mjs';
import { createHash } from 'node:crypto';

function clientIp(event) {
    const headers = event.headers || {};
    const forwarded = headers['x-vercel-forwarded-for']
        || headers['X-Vercel-Forwarded-For']
        || headers['x-forwarded-for']
        || headers['X-Forwarded-For']
        || '';
    return String(forwarded).split(',')[0].trim()
        || headers['x-real-ip']
        || headers['X-Real-Ip']
        || 'unknown';
}

function rateLimitKey(subject = '', includeIp = true, event = {}) {
    const rawKey = `${includeIp ? clientIp(event) : 'global'}:${String(subject).trim().toLowerCase()}`;
    return createHash('sha256').update(rawKey).digest('hex');
}

export async function clearRateLimit(scope, subject = '', { includeIp = false, event = {} } = {}) {
    const key = rateLimitKey(subject, includeIp, event);
    const { error } = await db().from('rate_limits').delete().eq('scope', scope).eq('key', key);
    if (error) throw error;
}

export async function consumeRateLimit(
    event,
    scope,
    { limit, windowSeconds, failClosed = false, includeIp = true },
    subject = '',
) {
    const key = rateLimitKey(subject, includeIp, event);
    const { data, error } = await db().rpc('consume_rate_limit', {
        p_scope: scope,
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
    });

    if (error) {
        console.error('Falha no rate limit:', error);
        return { allowed: !failClosed, remaining: null, unavailable: true };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return {
        allowed: result?.allowed !== false,
        remaining: Number.isFinite(Number(result?.remaining)) ? Number(result.remaining) : null,
        unavailable: false,
    };
}
