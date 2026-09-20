import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const files = [
    'supabase/migration-v4.50-colaboradores.sql',
    'public/assets/icons/colaborador-bizu.webp',
];
await Promise.all(files.map((file) => access(new URL(file, root))));

const [route, badges, community, adminUi, adminView, ranking, chat, presence, auth, login, rewards, migration, schema, worker] = await Promise.all([
    readFile(new URL('server/routes/admin-users.mjs', root), 'utf8'),
    readFile(new URL('public/app/foundation/badges.js', root), 'utf8'),
    readFile(new URL('public/app/domains/community.js', root), 'utf8'),
    readFile(new URL('public/app/domains/admin/users.js', root), 'utf8'),
    readFile(new URL('public/views/admin.html', root), 'utf8'),
    readFile(new URL('server/routes/ranking.mjs', root), 'utf8'),
    readFile(new URL('server/routes/chat.mjs', root), 'utf8'),
    readFile(new URL('server/platform/community.mjs', root), 'utf8'),
    readFile(new URL('server/platform/auth.mjs', root), 'utf8'),
    readFile(new URL('server/routes/login.mjs', root), 'utf8'),
    readFile(new URL('public/app/domains/rewards.js', root), 'utf8'),
    readFile(new URL('supabase/migration-v4.50-colaboradores.sql', root), 'utf8'),
    readFile(new URL('supabase/schema.sql', root), 'utf8'),
    readFile(new URL('public/service-worker.js', root), 'utf8'),
]);

assert(route.includes("action === 'set_contributor'"));
assert(route.includes("if (!isSupreme) return json(403"));
assert(route.includes("points = previousBonus ? 0 : 2000"));
assert(route.includes(".eq('chave', 'bonus-colaborador')"));
assert(route.includes("awardXp(id, 'bonus-colaborador'"));
assert(!adminView.includes('colaborador_motivo'));
assert(adminUi.includes('Destacar como colaborador'));
assert(adminUi.includes("status === 'colaborador'"));
assert(adminUi.includes('openContributorHistory'));
assert(adminView.includes('id="contributorHistoryModal"'));
assert(route.includes('params.colaborador_historico'));
assert(badges.includes('contributor-insignia'));
assert(badges.includes('/assets/icons/colaborador-bizu.webp'));
assert(community.includes("const COLLABORATOR_TOPIC_ID = 'mural-colaboradores'"));
assert(community.includes('Mural de Colaboradores'));
assert(community.includes('2.000 XP'));
for (const source of [ranking, chat, presence, auth, login]) assert(source.includes('colaborador'));
assert(rewards.includes("data.premio.plano === 'colaborador'"));
assert(migration.includes('create table if not exists public.colaboracoes_usuario'));
assert(migration.includes('u.colaborador'));
assert(migration.indexOf('u.xp_total') < migration.indexOf('u.premium'));
assert(migration.indexOf('u.premium') < migration.indexOf('u.plano_atual'));
assert(migration.indexOf('u.plano_atual') < migration.indexOf('u.colaborador'));
assert(schema.includes('colaborador boolean not null default false'));
assert(worker.includes('/assets/icons/colaborador-bizu.webp'));
assert((await stat(new URL('public/assets/icons/colaborador-bizu.webp', root))).size < 50_000);

console.log('Colaboradores v4.50: selo, bônus único de 2.000 XP, painel, mural e notificações validados.');
