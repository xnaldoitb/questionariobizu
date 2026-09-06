import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = [
    'server/routes/chat-salas.mjs','server/routes/suporte.mjs','server/routes/topicos.mjs',
    'supabase/migration-v4.35-comunidade-suporte-topicos.sql','public/styles/12-community-hub.css',
    'public/styles/13-visual-refinement.css','public/assets/icons/icon-192-v435.png',
    'public/assets/icons/icon-512-v435.png','public/assets/icons/icon-maskable-512-v435.png',
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
assert(manifest.includes('icon-512-v435.png'));
assert(!authView.includes('admin-contact-links'));
assert(fragments.includes('id="installAppClose"'));
assert(pwa.includes('!isInstalled() && !dismissed'));
assert(pwa.includes("sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1')"));
assert(pwaBrand.includes('.install-app-compact'));
assert(!pwaBrand.includes('width: min(100%, 320px)'));
assert(communityCss.includes('.community-modal-header .modal-close'));

console.log('v4.35: comunidade, suporte, tópicos, recuperação de login e atualização PWA validados.');
