import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PATENTS, patentForHits } from '../public/app/foundation/patents.js';
import { PATENTS as SERVER_PATENTS, patentStatus } from '../server/platform/patents.mjs';
import { localDay, progressiveMissionReward, roundMissionTarget, sequenceMissionTarget, startOfLocalDay, startOfLocalWeek, validAnswersMissionTarget } from '../server/platform/xp.mjs';

assert.equal(PATENTS.length, 52);
assert.equal(PATENTS.at(-1).min, 320000);
assert.equal(SERVER_PATENTS.at(-1).min, 320000);
assert.equal(patentForHits(199).name, 'Aspirante do Bizu');
assert.equal(patentForHits(200).name, 'Recruta do Conhecimento');
assert.equal(patentStatus(303000).nome, 'Comandante do Saber');
assert.equal(localDay(new Date('2026-09-08T02:59:59.000Z')), '2026-09-07');
assert.equal(startOfLocalDay(new Date('2026-09-08T14:37:15.000Z')), '2026-09-08T03:00:00.000Z');
assert.equal(startOfLocalWeek(new Date('2026-09-08T14:37:15.000Z')), '2026-09-07T03:00:00.000Z');
assert.deepEqual([0, 1, 2, 8].map(sequenceMissionTarget), [10, 20, 30, 90]);
assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(roundMissionTarget), [3, 6, 9, 12, 15, 18, 18]);
assert.deepEqual([0, 1, 2, 3].map((stage) => progressiveMissionReward(25, stage)), [25, 50, 75, 100]);
assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((stage) => progressiveMissionReward(40, stage, 6)), [40, 80, 120, 160, 200, 240, 240]);
assert.deepEqual([0, 1, 2, 3].map(validAnswersMissionTarget), [20, 40, 60, 80]);
assert.deepEqual([0, 1, 2, 3].map((stage) => progressiveMissionReward(60, stage)), [60, 120, 180, 240]);

const [migration, retroactive, historyProgress, xp, responder, sessions, adminUsers, adminUsersUi, notifications, missions, router, topbar, dashboard, quiz, fragments, progression, community, ranking, patent, index, worker] = await Promise.all([
    readFile('supabase/migration-v4.44.1-xp-missoes-notificacoes.sql', 'utf8'),
    readFile('supabase/migration-v4.46.1-retroativo-missoes.sql', 'utf8'),
    readFile('supabase/migration-v4.46.2-historico-preserva-xp.sql', 'utf8'),
    readFile('server/platform/xp.mjs', 'utf8'),
    readFile('server/routes/responder.mjs', 'utf8'),
    readFile('server/routes/sessoes.mjs', 'utf8'),
    readFile('server/routes/admin-users.mjs', 'utf8'),
    readFile('public/app/domains/admin/users.js', 'utf8'),
    readFile('server/routes/notificacoes.mjs', 'utf8'),
    readFile('server/routes/missoes.mjs', 'utf8'),
    readFile('api/[...route].js', 'utf8'),
    readFile('public/views/topbar.html', 'utf8'),
    readFile('public/views/dashboard.html', 'utf8'),
    readFile('public/views/quiz.html', 'utf8'),
    readFile('public/app/foundation/fragments.js', 'utf8'),
    readFile('public/app/domains/progression.js', 'utf8'),
    readFile('public/app/domains/community.js', 'utf8'),
    readFile('server/routes/ranking.mjs', 'utf8'),
    readFile('server/routes/patente.mjs', 'utf8'),
    readFile('public/index.html', 'utf8'),
    readFile('public/service-worker.js', 'utf8'),
]);

for (const marker of ['xp_total', 'xp_eventos', 'notificacoes', 'conceder_xp', 'retroativo-v1']) assert(migration.includes(marker));
assert(migration.includes('set xp_total = u.xp_total + p_pontos'));
for (const marker of ['America/Belem', 'missao:sequencia:', 'missao:ronda:', 'missao:ritmo-', 'missao:precisao-80:', 'missao:excelencia-90:', 'missao:constancia-7:', 'missao:centena-100:', 'missao:explorador-5:', 'retroativo-missoes-v1']) assert(retroactive.includes(marker));
assert(retroactive.includes('on conflict (usuario_id, chave) do nothing'));
assert(retroactive.includes('etapa * 25') && retroactive.includes('etapa * 40') && retroactive.includes('etapa * 60'));
assert(retroactive.includes('recompensa_progressiva_corrigida') && retroactive.includes('set xp_total = u.xp_total + t.pontos'));
for (const marker of ['redefinir_progresso_usuario', "e.tipo <> 'plano'", 'xp_total = v_bonus', 'eventos_removidos']) assert(historyProgress.includes(marker));
for (const marker of ["'primeiro_acerto', 10", "'correcao', 4", "'revisao', 3", "'dominio', 150", "'sessao', 20", "'precisao', 60", "'precisao', 30"]) assert(xp.includes(marker));
for (const marker of ['sequencia-progressiva', 'ronda-progressiva', 'ritmo-progressivo', 'precisao-diaria', 'excelencia-diaria', 'constancia-7', 'centena-semanal', 'explorador-semanal']) assert(xp.includes(marker));
for (const marker of ['roundTargets = [3, 6, 9, 12, 15, 18]', 'sequenceMissionTarget', 'roundMissionTarget', 'progressiveMissionReward', 'pontos_premiados', 'startOfLocalWeek']) assert(xp.includes(marker));
assert(xp.includes('details: { meta: roundTarget, disciplinas: disciplines }'));
assert(!xp.includes('details: { meta: roundTarget, disciplinas }'));
assert(xp.includes('missao:ritmo-${rhythmTarget}:${day}') && xp.includes('respostas_validas: dailyAnswers'));
assert(xp.includes('progressiveMissionReward(60, rhythmStages)'));
assert(responder.includes('awardAnswerXp') && responder.includes('chapterId: q.capitulo_id'));
assert(sessions.includes('awardSessionXp'));
assert(sessions.includes('xp_preservado: true'));
assert(!sessions.includes("from('xp_eventos').delete()"));
assert(adminUsers.includes("action === 'reset_progress'") && adminUsers.includes("rpc('redefinir_progresso_usuario'"));
assert(adminUsersUi.includes('data-user-command="reset_progress"') && adminUsersUi.includes('REDEFINIR PROGRESSO'));
for (const marker of ["action === 'gift_xp'", "awardXp(id, `presente:", "tipo: 'sistema'", "'xp_presenteado'"]) assert(adminUsers.includes(marker));
for (const marker of ['data-user-command="gift_xp"', "openAdminModal('xpGiftModal')", "sendUserAction(id, 'gift_xp'"]) assert(adminUsersUi.includes(marker));
assert(notifications.includes(".eq('usuario_id', user.id)") && notifications.includes('marcar_todas'));
assert(missions.includes('missionStatus(user.id, {'));
assert(missions.includes("['admin', 'supremo'].includes(user.perfil)") && missions.includes('award: false'));
assert(router.includes("['missoes',") && router.includes("['notificacoes',"));
for (const id of ['notificationsBtn', 'missionsBtn']) assert(topbar.includes(`id="${id}"`));
assert(topbar.includes('<div class="action-brand action-brand-static"') && !topbar.includes('<button class="action-brand"'));
for (const id of ['notificationsModal', 'missionsModal', 'notificationsClose', 'missionsClose']) assert(dashboard.includes(`id="${id}"`));
for (const id of ['quizNotificationsBtn', 'quizMissionsBtn']) assert(quiz.includes(`id="${id}"`) && progression.includes(`#${id}`));
for (const id of ['chatModal', 'supportModal', 'topicsModal', 'notificationsModal', 'missionsModal']) assert(fragments.includes(`'${id}'`));
assert(progression.includes("requestJson('notificacoes')") && progression.includes("requestJson('missoes')") && progression.includes('mission-group-title'));
assert(progression.includes('scheduleMissionRefresh') && progression.includes('missionsRetry'));
assert(missions.includes('limit: 90'));
assert(xp.includes('Promise.allSettled') && xp.includes('awardsAvailable'));
assert(xp.includes('modo_institucional') && xp.includes('Notificação da missão'));
assert(community.includes("XP_RULES_TOPIC_ID = 'regras-xp'") && community.includes('XP necessário para cada patente'));
assert(community.includes('Premium concede <strong>500 XP</strong>'));
assert(community.includes('10, 20, 30…') && community.includes('3, 6, 9, 12, 15 e 18'));
assert(community.includes('20, 40, 60… questões válidas') && community.includes('60, 120, 180… XP'));
assert(ranking.includes('xp_total') && patent.includes('xp_total'));
assert(xp.includes("rpc('metricas_missoes_v448'") && xp.includes("rpc('metricas_dominio_capitulo_v448'"));
assert(index.includes('15-progression-notifications.css') && index.includes('4.48.1'));
assert(worker.includes('questionario-bizu-v4.48.1') && worker.includes('15-progression-notifications.css'));

console.log('XP, missões progressivas, métricas agregadas e notificações v4.48 validados.');
