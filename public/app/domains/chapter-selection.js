import { safeText } from '../foundation/selectors.js';

function normalized(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
}

export function selectedChapterIds(root = document.querySelector('#chapterSelect')) {
    return [...root.querySelectorAll('input[data-chapter]:checked')].map((input) => input.value);
}

export function chapterSelectionIsValid(root = document.querySelector('#chapterSelect')) {
    return Boolean(root?.querySelector('[data-all]')?.checked || selectedChapterIds(root).length);
}

export function renderChapterSelection(root, chapters) {
    root.open = false;
    root.innerHTML = `<summary>Todos os capítulos</summary>
        <div class="chapter-options" role="group" aria-label="Selecionar capítulos">
            <div class="chapter-toolbar">
                <button type="button" data-chapter-action="all">Selecionar todos</button>
                <button type="button" data-chapter-action="clear">Limpar</button>
            </div>
            <div class="chapter-search-wrap">
                <input type="search" data-chapter-search placeholder="Buscar capítulo…" aria-label="Buscar capítulo">
            </div>
            <div class="chapter-option-list">
                <label class="chapter-all-row"><input type="checkbox" data-all checked>
                    <span class="chapter-number" aria-hidden="true">∞</span><span>Todos os capítulos</span></label>
                ${chapters.map((chapter, index) => `<label data-chapter-row data-search="${safeText(normalized(chapter.nome))}">
                    <input type="checkbox" data-chapter value="${safeText(chapter.id)}">
                    <span class="chapter-number" aria-hidden="true">${safeText(chapter.indice ?? index + 1)}</span>
                    <span>${safeText(chapter.nome)}</span></label>`).join('')}
                <p class="chapter-empty hidden">Nenhum capítulo encontrado.</p>
            </div>
        </div>`;

    const updateSummary = () => {
        const selected = selectedChapterIds(root);
        const all = root.querySelector('[data-all]').checked;
        root.querySelector('summary').textContent = all
            ? 'Todos os capítulos'
            : selected.length === 0
                ? 'Nenhum capítulo selecionado'
                : selected.length === 1
                    ? chapters.find((chapter) => String(chapter.id) === selected[0])?.nome || '1 capítulo selecionado'
                    : `${selected.length} capítulos selecionados`;
        root.classList?.toggle('has-empty-selection', !all && selected.length === 0);
    };
    root.onchange = (event) => {
        if (event.target.matches('[data-all]')) {
            if (event.target.checked) root.querySelectorAll('[data-chapter]').forEach((input) => { input.checked = false; });
        } else if (event.target.matches('[data-chapter]') && event.target.checked) {
            root.querySelector('[data-all]').checked = false;
        }
        updateSummary();
    };
    root.onclick = (event) => {
        const action = event.target.closest('[data-chapter-action]')?.dataset.chapterAction;
        if (!action) return;
        root.querySelectorAll('[data-chapter]').forEach((input) => { input.checked = false; });
        root.querySelector('[data-all]').checked = action === 'all';
        updateSummary();
    };
    root.oninput = (event) => {
        if (!event.target.matches('[data-chapter-search]')) return;
        const query = normalized(event.target.value.trim());
        let visible = 0;
        root.querySelectorAll('[data-chapter-row]').forEach((row) => {
            const show = !query || row.dataset.search.includes(query);
            row.classList.toggle('hidden', !show);
            if (show) visible += 1;
        });
        root.querySelector('.chapter-empty').classList.toggle('hidden', visible > 0);
    };
    root.onkeydown = (event) => {
        if (event.key === 'Escape') {
            root.open = false;
            root.querySelector('summary').focus();
        }
    };
    updateSummary();
}
