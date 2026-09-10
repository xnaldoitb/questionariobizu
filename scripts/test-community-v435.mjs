import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = [
    'server/routes/chat-salas.mjs','server/routes/suporte.mjs','server/routes/topicos.mjs',
    'supabase/migration-v4.35-comunidade-suporte-topicos.sql','public/styles/12-community-hub.css',
    'public/styles/13-visual-refinement.css','public/assets/icons/icon-192-v448.png',
    'public/assets/icons/icon-512-v448.png','public/assets/icons/icon-maskable-512-v448.png',
];
await Promise.all(files.map((file) => access(new URL(file, root))));

const view = await readFile(new URL('public/views/dashboard.html', root), 'utf8');
const community = await readFile(new URL('public/app/domains/community.js', root), 'utf8');
const router = await readFile(new URL('api/[...route].js', root), 'utf8');
const users = await readFile(new URL('server/routes/admin-users.mjs', root), 'utf8');
const adminUi = await readFile(new URL('public/app/domains/admin/users.js', root), 'utf8');
const login = await readFile(new URL('server/routes/login.mjs', root), 'utf8');
const pwa = await readFile(new URL('public/app/foundation/pwa.js', root), 'utf8');
const worker = await readFile(new URL('public/service-worker.js', root), 'utf8');
const manifest = await readFile(new URL('public/manifest.webmanifest', root), 'utf8');
const authView = await readFile(new URL('public/views/auth.html', root), 'utf8');
const fragments = await readFile(new URL('public/app/foundation/fragments.js', root), 'utf8');
const pwaBrand = await readFile(new URL('public/styles/10-pwa-brand.css', root), 'utf8');
const communityCss = await readFile(new URL('public/styles/12-community-hub.css', root), 'utf8');
const ranking = await readFile(new URL('server/routes/ranking.mjs', root), 'utf8');
const presence = await readFile(new URL('server/platform/community.mjs', root), 'utf8');
const chat = await readFile(new URL('server/routes/chat.mjs', root), 'utf8');
const rooms = await readFile(new URL('server/routes/chat-salas.mjs', root), 'utf8');
const topics = await readFile(new URL('server/routes/topicos.mjs', root), 'utf8');
const support = await readFile(new URL('server/routes/suporte.mjs', root), 'utf8');

for (const id of ['openSupportBtn','openTopicsBtn','chatRoomForm','supportModal','topicsModal']) assert(view.includes(`id="${id}"`));
for (const route of ['chat-salas','suporte','topicos']) assert(router.includes(`['${route}',`));
assert(community.includes("requestJson('chat-salas'"));
assert(community.includes("requestJson('suporte"));
assert(community.includes("requestJson('topicos"));
assert(users.includes("action === 'end_sessions'"));
assert(users.includes("clearRateLimit('login-conta'"));
assert(adminUi.includes('Encerrar sessões e liberar login'));
assert(login.includes('includeIp: false'));
assert(pwa.includes("type: 'SKIP_WAITING'"));
assert(worker.includes("event.data?.type === 'SKIP_WAITING'"));
assert(!worker.match(/install[\s\S]{0,180}self\.skipWaiting\(\)/));
assert(manifest.includes('icon-512-v448.png'));
assert(worker.includes('questionario-bizu-v4.48.0'));
assert(!worker.includes('OPENMOJI_CODES'));
assert(!authView.includes('admin-contact-links'));
assert(fragments.includes('id="installAppClose"'));
assert(pwa.includes('!isInstalled() && !dismissed'));
assert(pwa.includes("sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1')"));
assert(pwa.includes("window.addEventListener('beforeinstallprompt', captureInstallPrompt)"));
assert(pwa.includes("'Preparando instalação…'"));
assert(pwaBrand.includes('.install-app-compact'));
assert(!pwaBrand.includes('width: min(100%, 320px)'));
assert(communityCss.includes('.community-modal-header .modal-close'));
assert(ranking.includes('publicRankingEntry'));
assert(!ranking.match(/publicRankingEntry\([\s\S]{0,500}usuario_id:/));
assert(presence.includes('proprio: Boolean'));
assert(!presence.includes("usuario: row.usuarios?.usuario"));
assert(chat.includes('propria: row.usuario_id === currentUserId'));
assert(rooms.includes("throw new Error('PARTICIPANTES_INVALIDOS')"));
assert(!rooms.includes('Participante não encontrado:'));
assert(topics.includes('function publicTopic'));
assert(topics.includes('function publicReply'));
assert(!topics.includes('return { topico: topic, respostas:'));
assert(support.includes('propria: message.autor_id === currentUserId'));
assert(community.includes('const own = Boolean(item.propria)'));

console.log('v4.35.4: comunidade, minimização de dados, suporte, tópicos e PWA validados.');
