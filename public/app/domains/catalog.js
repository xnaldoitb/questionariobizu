import { requestJson } from '../foundation/request.js';
import { one, safeText } from '../foundation/selectors.js';
import { appState } from '../foundation/model.js';
import { renderChapterSelection } from './chapter-selection.js';

let onCatalogLoaded = () => {};

export function onCatalogReady(handler) {
    onCatalogLoaded = handler;
}

export async function refreshCatalog() {
    appState.catalog = await requestJson('catalogo');
    populateSubjectSelectors();
    onCatalogLoaded();
}

export function buildSubjectOptions(selected = '') {
    return appState.catalog.disciplinas.map((discipline) => `
        <option value="${discipline.id}" ${discipline.id === selected ? 'selected' : ''}>
            ${safeText(discipline.nome)}
        </option>
    `).join('');
}

export function populateSubjectSelectors() {
    const options = buildSubjectOptions();

    ['#subjectSelect', '#adminSubject', '#chapterSubject', '#exportSubject'].forEach((selector) => {
        const element = one(selector);
        if (element) {
            element.innerHTML = options;
        }
    });

    populateChapterSelector('#subjectSelect', '#chapterSelect', true);
    populateChapterSelector('#adminSubject', '#adminChapter', false);
}

export function populateChapterSelector(subjectSelector, chapterSelector, includeAll) {
    const subjectId = one(subjectSelector)?.value;
    const chapterSelect = one(chapterSelector);

    if (!chapterSelect) {
        return;
    }

    if (chapterSelector === '#chapterSelect') {
        renderChapterSelection(chapterSelect, appState.catalog.capitulos
            .filter((chapter) => chapter.disciplina_id === subjectId));
        return;
    }

    const allOption = includeAll
        ? '<option value="">Todos os capítulos</option>'
        : '';

    const chapterOptions = appState.catalog.capitulos
        .filter((chapter) => chapter.disciplina_id === subjectId)
        .map((chapter) => `
            <option value="${chapter.id}">${safeText(chapter.nome)}</option>
        `)
        .join('');

    chapterSelect.innerHTML = allOption + chapterOptions;
}
