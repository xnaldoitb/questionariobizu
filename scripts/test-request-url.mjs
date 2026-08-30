import assert from 'node:assert/strict';
import { getRouteName, requestQuery } from '../server/platform/request-url.mjs';
import { toNetlifyEvent } from '../server/platform/vercel-adapter.mjs';

function request(url, body = undefined) {
    return { url, body, method:'GET', headers:{cookie:'session=test'},
        get query() { throw new Error('The deprecated query getter must not be read'); },
    };
}
for (const route of ['login','catalogo','questoes','pagamento-webhook','pagamentos-reconciliar','admin-users']) {
    assert.equal(getRouteName(request(`/api/${route}`)), route);
    assert.equal(getRouteName(request(`/api/[...route]?route=${route}`)), route);
    assert.equal(getRouteName(request(`/api/%5B...route%5D?route=${route}`)), route);
}
assert.equal(getRouteName(request('/api?route=admin&route=users')), 'admin/users');
assert.equal(getRouteName(request('/api?route=%2Fcatalogo%2F')), 'catalogo');
assert.equal(getRouteName(request('/api/catalogo/')), 'catalogo');
assert.equal(getRouteName(request('https://example.test/api/catalogo')), 'catalogo');
assert.equal(getRouteName(request(undefined)), '');
const req = request('/api/questoes?route=questoes&disciplina=abc&pagina=2&q=a%2Bb+c&tag=x&tag=y&empty=&data.id=123&__proto__=safe', '{"answer":1}');
for (const adapter of [toNetlifyEvent]) {
    const event = adapter(req);
    assert.equal(event.body, '{"answer":1}');
    assert.equal(event.headers.cookie, 'session=test');
    assert.equal(event.queryStringParameters.disciplina, 'abc');
    assert.equal(event.queryStringParameters.pagina, '2');
    assert.equal(event.queryStringParameters.q, 'a+b c');
    assert.deepEqual(event.queryStringParameters.tag, ['x','y']);
    assert.equal(event.queryStringParameters.empty, '');
    assert.equal(event.queryStringParameters['data.id'], '123');
    assert.equal(event.queryStringParameters.__proto__, 'safe');
    assert.equal(Object.getPrototypeOf(event.queryStringParameters), null);
    assert.equal(adapter(request('/api/login',{usuario:'123'})).body, '{"usuario":"123"}');
}
assert.equal(Object.keys(requestQuery(request('/api/me'))).length, 0);
console.log('URL: rotas diretas/reescritas, parâmetros repetidos, filtros, webhook e adaptador passaram sem acessar o getter query.');
