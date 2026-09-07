import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEVELOPER_PATENT, PATENTS, patentButtonMarkup, patentForHits, patentInsigniaMarkup, patentProgress } from '../public/app/foundation/patents.js';
import { PATENTS as SERVER_PATENTS, patentStatus } from '../server/platform/patents.mjs';

assert.equal(PATENTS.length, 52);
assert.equal(SERVER_PATENTS.length, 52);
assert.deepEqual(PATENTS.map(({ min, name }) => [min, name]), SERVER_PATENTS.map(({ min, name }) => [min, name]));
assert.equal(patentForHits(0).name, 'Aspirante do Bizu');
assert.equal(patentForHits(19).name, 'Aspirante do Bizu');
assert.equal(patentForHits(20).name, 'Recruta do Conhecimento');
assert.equal(patentForHits(5000).name, 'Segundo-Tenente da Estratégia I');
assert.equal(patentForHits(6650).name, 'Oficial de Questões I');
assert.equal(patentForHits(30300).name, 'Comandante do Saber');
assert.equal(patentForHits(999999).name, 'Herói do Conhecimento');
assert.equal(patentProgress(19).remaining, 1);
assert.equal(patentStatus(32000).progresso, 100);
assert.equal(DEVELOPER_PATENT.name, 'Comandante do Código');
assert(patentInsigniaMarkup(0, { developer: true }).includes('patent-developer-marks'));
assert(patentButtonMarkup(0, { developer: true }).includes('data-developer="true"'));

const [dashboard, performance, main, topic, modal, css, route, router, migration, sessions] = await Promise.all([
    readFile('public/views/dashboard.html', 'utf8'),
    readFile('public/app/domains/performance.js', 'utf8'),
    readFile('public/app/main.js', 'utf8'),
    readFile('public/app/domains/community.js', 'utf8'),
    readFile('public/views/ranking.html', 'utf8'),
    readFile('public/styles/14-ranking-patents.css', 'utf8'),
    readFile('server/routes/patente.mjs', 'utf8'),
    readFile('api/[...route].js', 'utf8'),
    readFile('supabase/migration-v4.41-52-patentes-ranking.sql', 'utf8'),
    readFile('server/routes/sessoes.mjs', 'utf8'),
]);

assert(dashboard.includes('profile-patent-button') && !dashboard.includes('class="profile-avatar"'));
assert(performance.includes('patentButtonMarkup') && !performance.includes('ranking-avatar'));
for (const marker of ['my-rank-position', 'podium-results', 'ranking-person', 'ranking-primary-score']) assert(performance.includes(marker));
assert(main.includes('checkPatentNotification') && main.includes('renderProfilePatent'));
assert(main.includes("appState.user?.perfil === 'supremo'"));
assert(topic.includes("PATENT_GUIDE_TOPIC_ID = 'guia-patentes'"));
assert(topic.includes('Patentes do Ranking') && topic.includes('patent-guide-table'));
assert(topic.includes('DEVELOPER_PATENT') && topic.includes('patent-guide-special'));
assert(topic.includes('papiraoRow') && topic.includes('patent-guide-papirao'));
assert(modal.includes('id="patentModal"') && modal.includes('id="patentProgressBar"'));
assert(css.includes('.patent-insignia') && css.includes('.patent-guide-table'));
assert(patentInsigniaMarkup(0).includes('patent-trainee-mark'));
assert(patentInsigniaMarkup(20).includes('patent-enlisted-bars'));
assert(patentInsigniaMarkup(175).includes('patent-sergeant-chevrons'));
assert(patentInsigniaMarkup(2050).includes('patent-senior-sergeant'));
assert(patentInsigniaMarkup(5000).includes('patent-officer-pips'));
assert(patentInsigniaMarkup(9200).includes('patent-officer-stars'));
assert(patentInsigniaMarkup(12400).includes('patent-field-officer'));
assert(patentInsigniaMarkup(30300).includes('patent-command-50'));
assert(patentInsigniaMarkup(32000).includes('patent-hero-marks'));
assert(patentInsigniaMarkup(32000).includes('patent-tile-frame'));
assert(patentInsigniaMarkup(32000).includes('patent-tile-gloss'));
assert(route.includes(".eq('usuario_id', userId)") && route.includes('patente_notificada_nivel'));
assert(route.includes("user.perfil === 'supremo'") && route.includes('!developer'));
assert(router.includes("['patente', patente]"));
assert(migration.includes('between 0 and 51') && migration.includes('patente_notificada_nivel'));
assert(sessions.includes('patente_notificada_nivel: 0') && sessions.includes('papirao_notificado: false'));

console.log('Ranking v4.41: 52 patentes, cores progressivas, PAPIRÃO e guia fixo validados.');
