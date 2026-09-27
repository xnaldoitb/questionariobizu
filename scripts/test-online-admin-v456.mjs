import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [dashboard, admin, community, presence, route, management, onlineUi, migration, router] = await Promise.all([
    readFile('public/views/dashboard.html', 'utf8'),
    readFile('public/views/admin.html', 'utf8'),
    readFile('public/app/domains/community.js', 'utf8'),
    readFile('server/routes/presenca.mjs', 'utf8'),
    readFile('server/routes/admin-online.mjs', 'utf8'),
    readFile('public/app/domains/management.js', 'utf8'),
    readFile('public/app/domains/admin/online.js', 'utf8'),
    readFile('supabase/migration-v4.56-online.sql', 'utf8'),
    readFile('api/[...route].js', 'utf8'),
]);

assert(dashboard.includes('id="onlineCount"') && dashboard.includes('id="onlineSpotlight"'));
assert(!dashboard.includes('id="chatOnlineCount"'));
assert(community.includes("count > 99 ? '99+'"));
assert(presence.includes('presenceTotals'));
assert(admin.includes('data-admin="onlinePanel"') && admin.includes('id="adminOnlineFakeInput"'));
assert(management.includes("'onlinePanel'") && management.includes('bindOnlineManagement'));
assert(onlineUi.includes("requestJson('admin-online'"));
assert(route.includes("user.perfil !== 'supremo'") && route.includes('MAX_FAKE_ONLINE = 9999'));
assert(migration.includes('configuracoes_online') && migration.includes('fake_online between 0 and 9999'));
assert(router.includes("['admin-online'"));

console.log('v4.56: presença restaurada e painel administrativo de online validados.');
