import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [route, view, identity] = await Promise.all([
    readFile('server/routes/cadastro.mjs', 'utf8'),
    readFile('public/views/auth.html', 'utf8'),
    readFile('public/app/domains/identity.js', 'utf8'),
]);

assert(!route.includes("String(body.website || '').trim() ||"));
assert(!route.includes('elapsed > 2 * 60 * 60 * 1000'));
assert(route.includes('formStartedAt > 0') && route.includes('elapsed < 800'));
for (const marker of ['cadastro-ip-hora', 'cadastro-ip-dia', 'cadastro-dispositivo']) assert(route.includes(marker));
assert(view.includes('data-lpignore="true"') && view.includes('data-1p-ignore="true"'));
assert(identity.includes("website: ''"));

console.log('v4.56.3: cadastro sem falso bloqueio por autofill ou tempo de página validado.');
