import { safeText } from '../foundation/selectors.js';

export function selectedChapterIds(root = document.querySelector('#chapterSelect')) {
    return [...root.querySelectorAll('input[data-chapter]:checked')].map((input) => input.value);
}

export function chapterSelectionIsValid(root = document.querySelector('#chapterSelect')) {
    return Boolean(root?.querySelector('[data-all]')?.checked || selectedChapterIds(root).length);
}

export function renderChapterSelection(root, chapters) {
    root.innerHTML = `<div class="chapter-toolbar">
            <button type="button" data-chapter-action="all">Selecionar todos</button>
            <button type="button" data-chapter-action="clear">Limpar</button>
        </div>
        <div class="chapter-option-list">
            <label class="chapter-all-row"><input type="checkbox" data-all checked>
                <span class="chapter-number" aria-hidden="true">∞</span><span>Todos os capítulos</span></label>
            ${chapters.map((chapter, index) => `<label>
                <input type="checkbox" data-chapter value="${safeText(chapter.id)}">
                <span class="chapter-number" aria-hidden="true">${safeText(chapter.indice ?? index + 1)}</span>
                <span>${safeText(chapter.nome)}</span></label>`).join('')}
        </div>`;

    const updateSummary = () => {
        const selected = selectedChapterIds(root);
        const all = root.querySelector('[data-all]').checked;
        const selectedName = chapters.find((chapter) => String(chapter.id) === selected[0])?.nome;
        const title = all
            ? 'Todos os capítulos'
            : selected.length === 0
                ? 'Escolha os capítulos'
                : selected.length === 1
                    ? selectedName || '1 capítulo selecionado'
                    : `${selected.length} capítulos selecionados`;
        const detail = all
            ? `${chapters.length} ${chapters.length === 1 ? 'capítulo disponível' : 'capítulos disponíveis'}`
            : selected.length === 0
                ? 'Nenhum selecionado'
                : `${selected.length} de ${chapters.length} selecionados`;

        const page = typeof document === 'undefined' ? null : document;
        const summary = page?.querySelector('#chapterSelectionSummary');
        const meta = page?.querySelector('#chapterSelectionMeta');
        const status = page?.querySelector('#chapterModalStatus');
        if (summary) summary.textContent = title;
        if (meta) meta.textContent = detail;
        if (status) status.textContent = all ? 'Todos selecionados' : detail;
        page?.querySelector('#chapterPicker')?.classList.toggle('has-empty-selection', !all && selected.length === 0);
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

    updateSummary();
}
