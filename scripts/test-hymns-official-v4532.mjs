import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile('public/assets/hinos/hinos.json', 'utf8'));
const client = await readFile('public/app/domains/hymns.js', 'utf8');
const admin = await readFile('public/app/domains/admin/hymns.js', 'utf8');
const route = await readFile('server/routes/admin-hinos.mjs', 'utf8');
const bySlug = Object.fromEntries(data.hinos.map((song) => [song.slug, song]));
const types = new Set(['estrofe', 'coro', 'estribilho', 'parte']);

assert.equal(data.hinos.length, 17);
assert(data.hinos.every((song) => song.secoes.every((section) => types.has(section.tipo) && section.versos.length)));
assert.equal(bySlug['hino-a-fontoura'].secoes[1].tipo, 'coro');
assert.equal(bySlug['hino-do-aviador'].secoes[1].tipo, 'estribilho');
assert.equal(bySlug['hino-do-aviador'].secoes[3].versos.length, 8, 'O estribilho abreviado deve ser expandido.');
assert(!bySlug['hino-do-aviador'].secoes.flatMap((section) => section.versos).includes('Nascimento'), 'O sobrenome do compositor não é verso.');
assert.equal(bySlug['hino-a-bandeira'].secoes.length, 8);
assert(!bySlug['hino-a-bandeira'].secoes.flatMap((section) => section.versos).some((verse) => /\.\.\./.test(verse)));
assert.equal(bySlug['cancao-do-expedicionario'].secoes.filter((section) => section.tipo === 'estribilho').length, 4);
assert.equal(bySlug['cancao-do-bpchoque-pmpa'].secoes.length, 8);
assert(client.includes("section.tipo === 'estribilho'") && client.includes("section.tipo === 'parte'"));
assert(admin.includes("/^estribilho$/i") && admin.includes("/^parte\\b/i"));
assert(route.includes("'estrofe', 'coro', 'estribilho', 'parte'"));
assert(client.includes('function isConnector') && client.includes('data-reveal-word="${key}"'));
assert(client.includes('Os conectivos permanecem; toque nas iniciais destacadas'));

console.log('Hinos v4.54.1: organização oficial, estribilhos e repetições verificados.');
