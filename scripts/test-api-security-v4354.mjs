import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crossOriginMutation } from '../api/[...route].js';

function request(method, headers = {}) {
    return { method, headers };
}

const previousAppUrl = process.env.APP_URL;
delete process.env.APP_URL;

assert.equal(crossOriginMutation(request('GET'), 'ranking'), false);
assert.equal(crossOriginMutation(request('POST'), 'login'), true);
assert.equal(crossOriginMutation(request('POST', {
    origin: 'https://questionariobizu.vercel.app',
    host: 'questionariobizu.vercel.app',
}), 'login'), false);
assert.equal(crossOriginMutation(request('POST', {
    referer: 'https://questionariobizu.vercel.app/login',
    host: 'questionariobizu.vercel.app',
}), 'login'), false);
assert.equal(crossOriginMutation(request('DELETE', {
    origin: 'https://malicioso.example',
    host: 'questionariobizu.vercel.app',
}), 'sessoes'), true);
assert.equal(crossOriginMutation(request('POST'), 'pagamento-webhook'), false);

process.env.APP_URL = 'https://questionariobizu.vercel.app/';
assert.equal(crossOriginMutation(request('PUT', {
    origin: 'https://questionariobizu.vercel.app',
}), 'admin-users'), false);
assert.equal(crossOriginMutation(request('PUT', {
    origin: 'null',
}), 'admin-users'), true);

if (previousAppUrl === undefined) delete process.env.APP_URL;
else process.env.APP_URL = previousAppUrl;

const [ranking, presence, chat, rooms, support, topics, responder, exportRoute] = await Promise.all([
    readFile(new URL('../server/routes/ranking.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/platform/community.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/chat.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/chat-salas.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/suporte.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/topicos.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/responder.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/admin-export.mjs', import.meta.url), 'utf8'),
]);

assert(ranking.includes('publicRankingEntry'));
assert(!presence.includes("usuario: row.usuarios?.usuario"));
assert(chat.includes('propria: row.usuario_id === currentUserId'));
assert(!rooms.includes('Participante não encontrado:'));
assert(support.includes('propria: message.autor_id === currentUserId'));
assert(topics.includes('function publicTopic') && topics.includes('function publicReply'));
assert(responder.includes("if (pulada) return json(200, { ok: true, pulada: true") );
assert(exportRoute.includes("'cache-control':'private, no-store, max-age=0'"));

console.log('API v4.35.4: origem, minimização de dados, enumeração, gabarito e cache validados.');
