import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const data = JSON.parse(await readFile('public/assets/hinos/hinos.json', 'utf8'));
const view = await readFile('public/views/hymns.html', 'utf8');
const module = await readFile('public/app/domains/hymns.js', 'utf8');
const navigation = await readFile('public/app/foundation/navigation.js', 'utf8');
const fragments = await readFile('public/app/foundation/fragments.js', 'utf8');
const topbar = await readFile('public/views/topbar.html', 'utf8');
const dashboard = await readFile('public/views/dashboard.html', 'utf8');
const worker = await readFile('public/service-worker.js', 'utf8');

assert.equal(data.hinos.length, 17, 'A sala de canto deve conter 17 hinos.');
assert.equal(new Set(data.hinos.map((hino) => hino.slug)).size, 17, 'Os slugs dos hinos devem ser únicos.');
assert(data.hinos.every((hino) => hino.titulo && Array.isArray(hino.secoes) && hino.secoes.length), 'Todo hino precisa de título e seções.');
assert.equal(data.hinos.filter((hino) => hino.audio).length, 3, 'Devem existir três áudios oficiais.');
assert(view.includes('id="hymnsView"') && view.includes('data-hymn-mode="completar"') && view.includes('data-hymn-mode="ordem"'));
assert(module.includes('Nível da Memória') && module.includes('recordeCompletar') && module.includes('ordemConcluida'));
assert(module.includes("label: 'Nível 1'") && module.includes("label: 'Nível 5'"), 'Os botões da memória devem usar Nível 1 a Nível 5.');
assert(module.includes('hymn-complete-revealed') && module.includes('}, 1500);'), 'O exercício deve revelar a frase completa antes de avançar.');
assert(module.includes('function hiddenIndexes') && module.includes('memoryLevel < 1'), 'O nível Ler não pode ocultar palavras.');
assert(module.includes('Math.max(minimum') && module.includes('memoryLevel === 1 ? 1 : 2'), 'Os níveis devem garantir uma e duas lacunas por verso.');
assert(navigation.includes("'hymnsView'") && fragments.includes("'hymns.html'"));
assert(!topbar.includes('id="navHymns"'), 'Hinos não deve aparecer no menu principal.');
assert(dashboard.includes('id="hymnPicker"') && dashboard.includes('id="hymnModal"') && dashboard.includes('id="hymnOptions"'), 'A Sala de Canto deve ter seletor e janela abaixo das disciplinas.');
assert(dashboard.includes('panel study-panel hymns-study-panel') && dashboard.includes('discipline-filter hymn-filter'), 'A Sala de Canto deve repetir o padrão visual da seleção de disciplinas.');
assert(!dashboard.includes('id="openHymnsBtn"'), 'O antigo cartão de acesso não deve permanecer.');
assert(module.includes('function renderSelector()') && module.includes("openScreen('dashboard')"), 'O seletor de hinos deve abrir no painel.');
assert(worker.includes('/assets/hinos/hinos.json') && worker.includes('/styles/16-hymns.css'));

for (const hino of data.hinos.filter((item) => item.audio)) {
    const info = await stat(`public${hino.audio}`);
    assert(info.size > 100_000, `Áudio inválido: ${hino.audio}`);
}

console.log('Sala de canto v4.53.0: 17 hinos, treinos e áudios verificados.');
