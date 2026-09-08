import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [performance, patents, css, crown, worker] = await Promise.all([
    readFile('public/app/domains/performance.js', 'utf8'),
    readFile('public/app/foundation/patents.js', 'utf8'),
    readFile('public/styles/07-pmpa-moderno-minimalista.css', 'utf8'),
    readFile('public/assets/icons/coroa-papirao.svg', 'utf8'),
    readFile('public/service-worker.js', 'utf8'),
]);

assert(performance.includes("index === 0"));
assert(performance.includes("patentButtonMarkup(entry.xp_total, { papirao: true })"));
assert(patents.includes('podium-champion-crown'));
assert(patents.includes("coroa-papirao.svg"));
assert(patents.includes('data-papirao="true"'));
assert(performance.includes("<span class=\"podium-position\">${rankBadge(index)} ${index + 1}º</span>${patentButtonMarkup(entry.xp_total, { developer: developerEntry(entry), admin: adminEntry(entry) })}"));
assert(!performance.includes('ranking-avatar'));
assert(performance.includes('class="podium-name-line"'));
assert(performance.includes('class="podium-account-badges"'));

for (const marker of ['.podium-champion-crown::before', 'podium-crown-aura', 'podium-crown-lustre', 'prefers-reduced-motion']) {
    assert(css.includes(marker), `Estilo da coroa sem ${marker}`);
}
for (const marker of ['linearGradient id="gold"', 'feDropShadow', '#fffbd2', '#ffe782']) {
    assert(crown.includes(marker), `Coroa SVG sem ${marker}`);
}
assert(crown.includes('>PAPIRÃO</text>'));
assert(crown.includes('fill="#a52835"'));
assert(worker.includes('/assets/icons/coroa-papirao.svg'));

console.log('Ranking v4.38: coroa luminosa exclusiva do líder no card Top 3 passou.');
