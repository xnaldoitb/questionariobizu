import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PATENTS, patentForHits } from '../public/app/foundation/patents.js';
import { PATENTS as SERVER_PATENTS, patentStatus } from '../server/platform/patents.mjs';
import { localDay, startOfLocalDay } from '../server/platform/xp.mjs';

assert.equal(PATENTS.length, 52);
assert.equal(PATENTS.at(-1).min, 320000);
assert.equal(SERVER_PATENTS.at(-1).min, 320000);
assert.equal(patentForHits(199).name, 'Aspirante do Bizu');
assert.equal(patentForHits(200).name, 'Recruta do Conhecimento');
assert.equal(patentStatus(303000).nome, 'Comandante do Saber');
assert.equal(localDay(new Date('2026-09-08T02:59:59.000Z')), '2026-09-07');
assert.equal(startOfLocalDay(new Date('2026-09-08T14:37:15.000Z')), '2026-09-08T03:00:00.000Z');

const [migration, xp, responder, sessions, notifications, missions, router, topbar, dashboard, progression, community, ranking, patent, index, worker] = await Promise.all([
    readFile('supabase/migration-v4.44.1-xp-missoes-notificacoes.sql', 'utf8'),
    readFile('server/platform/xp.mjs', 'utf8'),
    readFile('server/routes/responder.mjs', 'utf8'),
    readFile('server/routes/sessoes.mjs', 'utf8'),
    readFile('server/routes/notificacoes.mjs', 'utf8'),
    readFile('server/routes/missoes.mjs', 'utf8'),
    readFile('api/[...route].js', 'utf8'),
    readFile('public/views/topbar.html', 'utf8'),
    readFile('public/views/dashboard.html', 'utf8'),
    readFile('public/app/domains/progression.js', 'utf8'),
    readFile('public/app/domains/community.js', 'utf8'),
    readFile('server/routes/ranking.mjs', 'utf8'),
    readFile('server/routes/patente.mjs', 'utf8'),
    readFile('public/index.html', 'utf8'),
    readFile('public/service-worker.js', 'utf8'),
]);

for (const marker of ['xp_total', 'xp_eventos', 'notificacoes', 'conceder_xp', 'retroativo-v1']) assert(migration.includes(marker));
assert(migration.includes('set xp_total = u.xp_total + p_pontos'));
for (const marker of ["'primeiro_acerto', 10", "'correcao', 4", "'revisao', 3", "'dominio', 150", "'sessao', 20", "'precisao', 60", "'precisao', 30"]) assert(xp.includes(marker));
for (const marker of ['sequencia-10', 'disciplinas-3', 'constancia-7']) assert(xp.includes(marker));
assert(responder.includes('awardAnswerXp') && responder.includes('chapterId: q.capitulo_id'));
assert(sessions.includes('awardSessionXp'));
assert(notifications.includes(".eq('usuario_id', user.id)") && notifications.includes('marcar_todas'));
assert(missions.includes("missionStatus(user.id, { award: true })"));
assert(router.includes("['missoes', missoes]") && router.includes("['notificacoes', notificacoes]"));
for (const id of ['notificationsBtn', 'missionsBtn']) assert(topbar.includes(`id="${id}"`));
assert(topbar.includes('<div class="action-brand action-brand-static"') && !topbar.includes('<button class="action-brand"'));
for (const id of ['notificationsModal', 'missionsModal', 'notificationsClose', 'missionsClose']) assert(dashboard.includes(`id="${id}"`));
assert(progression.includes("requestJson('notificacoes')") && progression.includes("requestJson('missoes')"));
assert(community.includes("XP_RULES_TOPIC_ID = 'regras-xp'") && community.includes('XP necessário para cada patente'));
assert(community.includes('Premium concede <strong>500 XP</strong>'));
assert(ranking.includes('xp_total') && patent.includes('xp_total'));
assert(index.includes('15-progression-notifications.css') && index.includes('4.44.3'));
assert(worker.includes('v4.44.3-contagem-missoes') && worker.includes('15-progression-notifications.css'));

console.log('XP, missões, notificações e tópico oficial v4.44 validados.');
