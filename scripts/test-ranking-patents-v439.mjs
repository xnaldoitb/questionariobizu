import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ADMIN_PATENT, DEVELOPER_PATENT, PATENTS, patentButtonMarkup, patentForHits, patentInsigniaMarkup, patentProgress } from '../public/app/foundation/patents.js';
import { PATENTS as SERVER_PATENTS, patentStatus } from '../server/platform/patents.mjs';

assert.equal(PATENTS.length, 52);
assert.equal(SERVER_PATENTS.length, 52);
assert.deepEqual(PATENTS.map(({ min, name }) => [min, name]), SERVER_PATENTS.map(({ min, name }) => [min, name]));
assert.equal(patentForHits(0).name, 'Aspirante do Bizu');
assert.equal(patentForHits(19).name, 'Aspirante do Bizu');
assert.equal(patentForHits(20).name, 'Recruta do Conhecimento');
assert.equal(patentForHits(5000).name, 'Segundo-Tenente da Estratégia I');
assert.equal(patentForHits(4300).name, 'Subtenente do Conhecimento');
assert.equal(patentForHits(6650).name, 'Oficial de Questões I');
assert.equal(patentForHits(30300).name, 'Comandante do Saber');
assert.equal(patentForHits(999999).name, 'Herói do Conhecimento');
assert.equal(patentProgress(19).remaining, 1);
assert.equal(patentStatus(32000).progresso, 100);
assert.equal(DEVELOPER_PATENT.name, 'Comandante do Código');
assert.equal(ADMIN_PATENT.name, 'Oficial de Instrução');
assert(patentInsigniaMarkup(0, { developer: true }).includes('patent-developer-marks'));
assert(patentButtonMarkup(0, { developer: true }).includes('data-developer="true"'));
assert(patentInsigniaMarkup(0, { admin: true }).includes('patent-admin-book'));
assert(patentInsigniaMarkup(0, { admin: true }).includes('patent-admin-label'));
assert(patentButtonMarkup(0, { admin: true }).includes('data-admin="true"'));

const [dashboard, performance, main, topic, modal, css, badges, route, router, migration, sessions, rankingRoute, rankingMigration] = await Promise.all([
    readFile('public/views/dashboard.html', 'utf8'),
    readFile('public/app/domains/performance.js', 'utf8'),
    readFile('public/app/main.js', 'utf8'),
    readFile('public/app/domains/community.js', 'utf8'),
    readFile('public/views/ranking.html', 'utf8'),
    readFile('public/styles/14-ranking-patents.css', 'utf8'),
    readFile('public/app/foundation/badges.js', 'utf8'),
    readFile('server/routes/patente.mjs', 'utf8'),
    readFile('api/[...route].js', 'utf8'),
    readFile('supabase/migration-v4.41-52-patentes-ranking.sql', 'utf8'),
    readFile('server/routes/sessoes.mjs', 'utf8'),
    readFile('server/routes/ranking.mjs', 'utf8'),
    readFile('supabase/migration-v4.42-ranking-todos-usuarios.sql', 'utf8'),
]);

assert(dashboard.includes('profile-patent-button') && !dashboard.includes('class="profile-avatar"'));
assert(!dashboard.includes('profilePatentName'));
assert(performance.includes('patentButtonMarkup') && !performance.includes('ranking-avatar'));
for (const hiddenName of ['rankingPatentName', 'podium-patent-name', 'ranking-patent-name']) assert(!performance.includes(hiddenName));
for (const marker of ['podium-results', 'ranking-person', 'ranking-primary-score']) assert(performance.includes(marker));
assert(!performance.includes('myRankingCard') && !modal.includes('myRankingCard'));
assert(!performance.includes('${entry.sessoes} sessões'));
assert(main.includes('checkPatentNotification') && main.includes('renderProfilePatent'));
assert(main.includes("appState.user?.perfil === 'supremo'"));
assert(main.includes("appState.user?.perfil === 'admin'"));
assert(topic.includes("PATENT_GUIDE_TOPIC_ID = 'guia-patentes'"));
assert(topic.includes('Patentes do Ranking') && topic.includes('patent-guide-table'));
assert(topic.includes('DEVELOPER_PATENT') && topic.includes('patent-guide-special'));
assert(topic.includes('ADMIN_PATENT') && topic.includes('patent-guide-admin'));
assert(topic.includes('papiraoRow') && topic.includes('patent-guide-papirao'));
assert(modal.includes('id="patentModal"') && modal.includes('id="patentProgressBar"'));
assert(css.includes('.patent-insignia') && css.includes('.patent-guide-table'));
assert(css.includes('@keyframes patent-hero-glow') && css.includes('.patent-hero-cluster'));
assert(css.includes('.ranking-list { display:grid; grid-template-columns:1fr;'));
assert(css.includes('.ranking-card { grid-template-columns:30px 38px minmax(88px,1fr) minmax(82px,92px);'));
assert(css.includes(':root[data-theme="light"] .ranking-card .ranking-position'));
assert(performance.includes('class="ranking-account-badges"'));
assert(performance.includes('class="podium-name-line"') && performance.includes('class="podium-account-badges"'));
assert(css.includes('.ranking-account-badges .account-insignia'));
assert(css.includes('.podium-account-badges .account-insignia'));
assert(css.includes('.podium-name-line > strong { display:block; max-width:100%; white-space:normal; overflow-wrap:anywhere;'));
assert(css.includes('.ranking-name-line > strong { display:block; width:100%; max-width:100%; white-space:normal; overflow-wrap:anywhere;'));
assert(!css.includes('.ranking-card .premium-insignia::after'));
assert(badges.includes('>♛ DEV</span>'));
assert(badges.includes('>✚ PLUS</span>'));
assert(badges.includes('>◇ PREMIUM</span>'));
assert(css.includes('.ranking-person { grid-template-columns:minmax(0,1fr);'));
assert(patentInsigniaMarkup(0).includes('patent-trainee-mark'));
assert(patentInsigniaMarkup(20).includes('patent-enlisted-bars'));
assert(patentInsigniaMarkup(175).includes('patent-sergeant-chevrons'));
assert(patentInsigniaMarkup(175).includes('patent-sergeant-base'));
assert(patentInsigniaMarkup(275).includes('patent-sergeant-tier-1'));
assert(patentInsigniaMarkup(750).includes('patent-sergeant-tier-2'));
assert.equal((patentInsigniaMarkup(275).match(/class="patent-chevron"/g) || []).length, 2);
assert.equal((patentInsigniaMarkup(400).match(/patent-progressive-base/g) || []).length, 2);
assert.equal((patentInsigniaMarkup(550).match(/patent-progressive-base/g) || []).length, 3);
assert.equal((patentInsigniaMarkup(750).match(/class="patent-chevron"/g) || []).length, 3);
assert(patentInsigniaMarkup(750).includes('patent-progressive-dots'));
assert.equal((patentInsigniaMarkup(750).match(/class="patent-grade-dot"/g) || []).length, 1);
assert.equal((patentInsigniaMarkup(1000).match(/class="patent-grade-dot"/g) || []).length, 2);
assert.equal((patentInsigniaMarkup(1300).match(/class="patent-grade-dot"/g) || []).length, 3);
assert(patentInsigniaMarkup(2050).includes('patent-senior-sergeant'));
assert.equal((patentInsigniaMarkup(2050).match(/class="patent-chevron"/g) || []).length, 4);
assert.equal((patentInsigniaMarkup(2050).match(/class="patent-star"/g) || []).length, 1);
assert(patentInsigniaMarkup(4300).includes('patent-subtenente-triangle'));
assert.equal((patentInsigniaMarkup(4300).match(/class="patent-chevron"/g) || []).length, 0);
assert.equal((patentInsigniaMarkup(4300).match(/class="patent-star"/g) || []).length, 1);
assert.equal(new Set(PATENTS.slice(4, 17).map((patent) => patentInsigniaMarkup(patent.min))).size, 13);
assert(patentInsigniaMarkup(5000).includes('patent-officer-pips'));
assert(patentInsigniaMarkup(9200).includes('patent-officer-stars'));
assert(patentInsigniaMarkup(12400).includes('patent-field-officer'));
assert.equal(new Set(PATENTS.slice(31, 36).map((patent) => patentInsigniaMarkup(patent.min))).size, 5);
assert.equal(new Set(PATENTS.slice(36, 41).map((patent) => patentInsigniaMarkup(patent.min))).size, 5);
assert.equal((patentInsigniaMarkup(12400).match(/patent-major-grade/g) || []).length, 1);
assert.equal((patentInsigniaMarkup(15400).match(/patent-major-grade/g) || []).length, 5);
assert.equal((patentInsigniaMarkup(16200).match(/patent-lieutenant-grade/g) || []).length, 1);
assert.equal((patentInsigniaMarkup(19700).match(/patent-lieutenant-grade/g) || []).length, 5);
assert(patentInsigniaMarkup(30300).includes('patent-command-50'));
assert(patentInsigniaMarkup(30300).includes('patent-command-stars'));
assert(patentInsigniaMarkup(32000).includes('patent-hero-marks'));
assert(patentInsigniaMarkup(32000).includes('patent-hero-cluster'));
assert(!patentInsigniaMarkup(30300).includes('patent-command-wing'));
assert(!patentInsigniaMarkup(32000).includes('patent-hero-wings'));
assert.equal((patentInsigniaMarkup(30300).match(/class="patent-star"/g) || []).length, 5);
assert.equal((patentInsigniaMarkup(32000).match(/class="patent-star"/g) || []).length, 6);
assert(patentInsigniaMarkup(32000).includes('patent-tile-frame'));
assert(patentInsigniaMarkup(32000).includes('patent-tile-gloss'));
assert(route.includes(".eq('usuario_id', userId)") && route.includes('patente_notificada_nivel'));
assert(route.includes("['admin', 'supremo'].includes(user.perfil)") && route.includes('!institutional'));
assert(router.includes("['patente', patente]"));
assert(migration.includes('between 0 and 51') && migration.includes('patente_notificada_nivel'));
assert(sessions.includes('patente_notificada_nivel: 0') && sessions.includes('papirao_notificado: false'));
assert(rankingRoute.includes(".from('usuarios')") && rankingRoute.includes('users.map'));
assert(rankingMigration.includes('left join public.respostas') && !rankingMigration.includes('status_aprovacao'));

console.log('Ranking v4.43.3: nomes completos, ADM institucional e progressão Major/Tenente-Coronel validados.');
