import { api } from '../core/api.js';
import { $, escapeHtml } from '../core/dom.js';
import { state } from '../core/state.js';

let onCatalogLoaded = () => {};

export function setCatalogLoadedHandler(handler) {
    onCatalogLoaded = handler;
}

export async function loadCatalog() {
    state.catalog = await api('catalogo');
    fillSubjectSelects();
    onCatalogLoaded();
}

export function subjectOptions(selected = '') {
    return state.catalog.disciplinas.map((discipline) => `
        <option value="${discipline.id}" ${discipline.id === selected ? 'selected' : ''}>
            ${escapeHtml(discipline.nome)}
        </option>
    `).join('');
}

export function fillSubjectSelects() {
    const options = subjectOptions();

    ['#subjectSelect', '#adminSubject', '#chapterSubject', '#exportSubject'].forEach((selector) => {
        const element = $(selector);
        if (element) {
            element.innerHTML = options;
        }
    });

    fillChapterSelect('#subjectSelect', '#chapterSelect', true);
    fillChapterSelect('#adminSubject', '#adminChapter', false);
}

export function fillChapterSelect(subjectSelector, chapterSelector, includeAll) {
    const subjectId = $(subjectSelector)?.value;
    const chapterSelect = $(chapterSelector);

    if (!chapterSelect) {
        return;
    }

    const allOption = includeAll
        ? '<option value="">Todos os capítulos</option>'
        : '';

    const chapterOptions = state.catalog.capitulos
        .filter((chapter) => chapter.disciplina_id === subjectId)
        .map((chapter) => `
            <option value="${chapter.id}">${escapeHtml(chapter.nome)}</option>
        `)
        .join('');

    chapterSelect.innerHTML = allOption + chapterOptions;
}
