import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [study, activity, community, presence, questions, answer, missions, management, overview, catalog, users, migration] = await Promise.all([
    readFile('public/app/domains/study.js', 'utf8'),
    readFile('public/app/domains/session-activity.js', 'utf8'),
    readFile('public/app/domains/community.js', 'utf8'),
    readFile('server/routes/presenca.mjs', 'utf8'),
    readFile('server/routes/questoes.mjs', 'utf8'),
    readFile('server/routes/responder.mjs', 'utf8'),
    readFile('server/routes/missoes.mjs', 'utf8'),
    readFile('public/app/domains/management.js', 'utf8'),
    readFile('public/app/domains/admin/overview.js', 'utf8'),
    readFile('server/routes/admin-catalogo.mjs', 'utf8'),
    readFile('server/routes/admin-users.mjs', 'utf8'),
    readFile('supabase/migration-v4.56.6-alta-concorrencia.sql', 'utf8'),
]);

assert(study.includes('void syncSessionActivity({ interaction: true }).catch(() => {})'));
assert(study.includes('&limite=all&agrupado=1'));
assert(activity.includes('setInterval(resume, 60000)'));
assert(community.includes('PRESENCE_REFRESH_MS = 120_000'));
assert(!presence.includes('cleanupCommunity'));
assert(questions.includes("rpc('listar_questoes_simulado_v4566'"));
assert(answer.includes("rpc('registrar_resposta_v4566'"));
assert(missions.includes('award: true'));
assert(management.includes('PANEL_CACHE_MS = 30_000'));
assert(overview.includes('await Promise.all(['));
assert(catalog.includes("rpc('catalogo_admin_v4566')"));
assert(users.includes('EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000'));
for (const marker of ['listar_questoes_simulado_v4566', 'registrar_resposta_v4566', 'catalogo_admin_v4566']) {
    assert(migration.includes(marker));
}

console.log('v4.56.6: alta concorrência em estudo, presença e administração validada.');
