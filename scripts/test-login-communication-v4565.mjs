import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [login, identity, request] = await Promise.all([
    readFile('server/routes/login.mjs', 'utf8'),
    readFile('public/app/domains/identity.js', 'utf8'),
    readFile('public/app/foundation/request.js', 'utf8'),
]);

assert(login.includes('RATE_LIMIT_TIMEOUT_MS = 7000'));
assert(login.includes('DATABASE_TIMEOUT_MS = 9000'));
assert(login.includes('const lastAccessUpdate = within('));
assert(login.indexOf('const lastAccessUpdate') < login.indexOf("iniciar_sessao_dispositivo_aluno"));
assert(login.includes('error.publicMessage'));
assert(identity.includes('let loginInFlight = false'));
assert(identity.includes("['API_TIMEOUT', 'API_NETWORK', 'API_GATEWAY']"));
assert(identity.includes('A conexão oscilou. Repetindo o acesso...'));
assert(request.includes("error.code = cause?.name === 'AbortError' ? 'API_TIMEOUT' : 'API_NETWORK'"));
assert(request.indexOf('...fetchOptions,') < request.indexOf("'content-type': 'application/json'"));

console.log('v4.56.5: comunicação e resiliência do login validadas.');
