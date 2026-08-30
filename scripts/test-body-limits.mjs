import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bodyLimitResponse } from '../server/platform/body-limits.mjs';
import { IMPORT_BODY_LIMIT } from '../public/app/foundation/import-limits.js';

const size = 64 * 1024;
assert.equal(bodyLimitResponse('login', 'POST', 'x'.repeat(size)), null);
for (const route of ['login', 'cadastro', 'admin-users', 'pagamento-criar']) {
    assert.ok(bodyLimitResponse(route, 'POST', 'x'.repeat(size + 1)));
}
assert.equal(bodyLimitResponse('admin-import', 'POST', 'x'.repeat(size + 1)), null);
assert.equal(bodyLimitResponse('admin-import', 'POST', 'x'.repeat(IMPORT_BODY_LIMIT)), null);
assert.ok(bodyLimitResponse('admin-import', 'POST', 'x'.repeat(IMPORT_BODY_LIMIT + 1)));
assert.ok(bodyLimitResponse('admin-import', 'GET', 'x'.repeat(size + 1)));
assert.ok(bodyLimitResponse('admin-import-other', 'POST', 'x'.repeat(size + 1)));
assert.ok(bodyLimitResponse('login', 'POST', 'á'.repeat(size / 2 + 1)));
assert.ok(bodyLimitResponse('login', 'POST', 'x'.repeat(size + 1), { 'content-length': '1' }));
assert.ok(bodyLimitResponse('login', 'POST', '', { 'content-length': String(size + 1) }));
const source = JSON.parse(readFileSync(new URL('../questions-source.json', import.meta.url)));
const payload = JSON.stringify({ arquivo: source });
assert.ok(Buffer.byteLength(payload) > size);
assert.equal(bodyLimitResponse('admin-import', 'POST', payload), null);
const handler = readFileSync(new URL('../server/routes/admin-import.mjs', import.meta.url), 'utf8');
assert.ok(handler.indexOf("requireUser(event, 'supremo')") < handler.indexOf('const body = parseBody(event)'));
console.log('Limites validados: importação real >64 KiB, fronteiras de 4 MiB, UTF-8, cabeçalho ausente/falso e restrição de permissão preservada.');
