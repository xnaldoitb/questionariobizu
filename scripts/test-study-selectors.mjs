import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { disciplineIcon } from '../public/app/domains/discipline-selection.js';

assert.equal(disciplineIcon('Direito Penal Militar'), '2696');
assert.equal(disciplineIcon('Armamento e Tiro'), '1F3AF');
assert.equal(disciplineIcon('Legislação de Trânsito'), '1F6A6');
assert.equal(disciplineIcon('Informática'), '1F4BB');
assert.equal(disciplineIcon('Disciplina sem categoria'), '1F4D6');

for (const code of ['2696','1F3AF','1F6A6','26D1','1F4BB','1F6E1','1F3C3','1F9E0','1F50D','1F4D6']) {
    await access(new URL(`../public/assets/openmoji/${code}.svg`, import.meta.url));
}

const view = await readFile(new URL('../public/views/dashboard.html', import.meta.url), 'utf8');
const chapters = await readFile(new URL('../public/app/domains/chapter-selection.js', import.meta.url), 'utf8');
const study = await readFile(new URL('../public/app/domains/study.js', import.meta.url), 'utf8');
assert(view.includes('id="subjectPicker"'));
assert(view.includes('id="subjectSelect" type="hidden"'));
assert(!view.includes('<select id="subjectSelect"'));
assert(view.includes('role="radiogroup"'));
assert.equal((view.match(/name="questionLimit"/g) || []).length, 6);
assert(!chapters.includes('data-chapter-search'));
assert(chapters.includes('data-chapter-action="clear"'));
assert(study.includes('chapterSelectionIsValid()'));
assert(study.includes('input[name="questionLimit"]:checked'));

console.log('Seletores: disciplina visual, busca sob toque, capítulos sem busca, seleção vazia e quantidades segmentadas validados.');
