import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { disciplineIcon } from '../public/app/domains/discipline-selection.js';

assert.equal(disciplineIcon('Direito Penal Militar'), 'law');
assert.equal(disciplineIcon('Armamento e Tiro'), 'target');
assert.equal(disciplineIcon('Legislação de Trânsito'), 'traffic');
assert.equal(disciplineIcon('Informática'), 'computer');
assert.equal(disciplineIcon('Disciplina sem categoria'), 'book');

const view = await readFile(new URL('../public/views/dashboard.html', import.meta.url), 'utf8');
const chapters = await readFile(new URL('../public/app/domains/chapter-selection.js', import.meta.url), 'utf8');
const filters = await readFile(new URL('../public/app/domains/study-filter-modals.js', import.meta.url), 'utf8');
const icons = await readFile(new URL('../public/app/foundation/study-icons.js', import.meta.url), 'utf8');
const study = await readFile(new URL('../public/app/domains/study.js', import.meta.url), 'utf8');
assert(view.includes('id="subjectPicker"'));
assert(view.includes('id="subjectModal"'));
assert(view.includes('id="chapterModal"'));
assert(view.includes('id="subjectSelect" type="hidden"'));
assert(!view.includes('<select id="subjectSelect"'));
assert(view.includes('role="radiogroup"'));
assert.equal((view.match(/name="questionLimit"/g) || []).length, 6);
assert(!chapters.includes('data-chapter-search'));
assert(chapters.includes('data-chapter-action="clear"'));
assert(filters.includes("modal.querySelector('.study-modal-close')?.focus"));
assert(!filters.includes('subjectSearch.focus'));
assert(icons.includes('<svg class="${className}"'));
assert(study.includes('chapterSelectionIsValid()'));
assert(study.includes('input[name="questionLimit"]:checked'));

console.log('Seletores: botões de disciplina/capítulos, janelas compactas, ícones próprios e quantidade segmentada validados.');
