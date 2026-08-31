import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const picker = await readFile(new URL('public/app/domains/emoji-picker.js', root), 'utf8');
const community = await readFile(new URL('public/app/domains/community.js', root), 'utf8');
const view = await readFile(new URL('public/views/dashboard.html', root), 'utf8');
const route = await readFile(new URL('server/routes/chat.mjs', root), 'utf8');
const license = await readFile(new URL('public/assets/openmoji/LICENSE.txt', root), 'utf8');
const assets = (await readdir(new URL('public/assets/openmoji/', root))).filter((name) => name.endsWith('.svg'));

assert(assets.length >= 60, 'A seleção local deve conter pelo menos 60 emojis.');
await Promise.all(assets.map((name) => access(new URL(`public/assets/openmoji/${name}`, root))));
assert(picker.includes("new Intl.Segmenter('pt-BR', { granularity: 'grapheme' })"));
assert(picker.includes("localStorage.setItem(RECENT_KEY"));
assert(community.includes('bindEmojiPicker()'));
assert(community.includes('countGraphemes(message) > 400'));
assert(view.includes('id="emojiPicker"'));
assert(view.includes('CC BY-SA 4.0'));
assert(route.includes('messageLength(message) > MAX_MESSAGE_LENGTH'));
assert(license.includes('Creative Commons Attribution-ShareAlike 4.0'));

console.log(`OpenMoji: ${assets.length} SVGs locais, busca, categorias, recentes, atribuição e contagem Unicode validados.`);
