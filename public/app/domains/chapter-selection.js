import { safeText } from '../foundation/selectors.js';

export function selectedChapterIds(root = document.querySelector('#chapterSelect')) {
    return [...root.querySelectorAll('input[data-chapter]:checked')].map((input) => input.value);
}

export function renderChapterSelection(root, chapters) {
    root.open = false;
    root.innerHTML = `<summary>Todos os capítulos</summary>
        <div class="chapter-options" role="group" aria-label="Selecionar capítulos">
            <label><input type="checkbox" data-all checked> <span>Todos os capítulos</span></label>
            ${chapters.map((chapter) => `<label><input type="checkbox" data-chapter value="${safeText(chapter.id)}">
                <span>${safeText(chapter.nome)}</span></label>`).join('')}
        </div>`;
    root.onchange = (event) => {
        if (event.target.matches('[data-all]')) {
            root.querySelectorAll('[data-chapter]').forEach((input) => { input.checked = false; });
        }
        const selected = selectedChapterIds(root);
        root.querySelector('[data-all]').checked = selected.length === 0;
        root.querySelector('summary').textContent = selected.length === 0
            ? 'Todos os capítulos'
            : selected.length === 1
                ? chapters.find((chapter) => String(chapter.id) === selected[0]).nome
                : `${selected.length} capítulos selecionados`;
    };
    root.onkeydown = (event) => {
        if (event.key === 'Escape') {
            root.open = false;
            root.querySelector('summary').focus();
        }
    };
}
