// Do not access Vercel's lazy query getter: it invokes legacy url.parse().
export function parseRequestUrl(req) {
    return new URL(req.url || '/', 'http://localhost');
}

export function requestQuery(req) {
    const query = Object.create(null);
    for (const [key, value] of parseRequestUrl(req).searchParams) {
        if (!Object.hasOwn(query, key)) query[key] = value;
        else if (Array.isArray(query[key])) query[key].push(value);
        else query[key] = [query[key], value];
    }
    return query;
}

export function getRouteName(req) {
    const query = requestQuery(req);
    if (Array.isArray(query.route)) return query.route.filter(Boolean).join('/');
    if (typeof query.route === 'string' && query.route.trim()) return query.route.replace(/^\/+|\/+$/g, '');
    return parseRequestUrl(req).pathname.replace(/^\/api\/?/, '').replace(/\/+$/g, '');
}
