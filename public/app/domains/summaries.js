import { one, safeText, notify } from '../foundation/selectors.js';
import { openScreen } from '../foundation/navigation.js';

let summaries = [];

function searchable(value) {
    return String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function loadSummaries({ force = false } = {}) {
    if (summaries.length && !force) return summaries;
    const response = await fetch('/api/resumos', { credentials: 'include', cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.erro || 'Não foi possível carregar os resumos.');
    summaries = Array.isArray(payload.resumos) ? payload.resumos : [];
    return summaries;
}

function renderOptions(query = '') {
    const list = one('#summaryOptions');
    if (!list) return;
    const term = searchable(query);
    const visible = summaries.filter((item) => searchable(`${item.titulo} ${item.disciplina} ${item.descricao || ''}`).includes(term));
    list.innerHTML = visible.length ? visible.map((item) => `
        <a href="/api/resumo-arquivo?slug=${encodeURIComponent(item.slug)}" target="_blank" rel="noopener noreferrer" data-summary-open="${safeText(item.slug)}">
            <span class="summary-line-icon" aria-hidden="true">PDF</span>
            <span><strong>${safeText(item.titulo)}</strong><small>${safeText(item.disciplina)}${item.descricao ? ` · ${safeText(item.descricao)}` : ''}</small></span>
            <i aria-hidden="true">Abrir ↗</i>
        </a>
    `).join('') : '<div class="summary-empty">Nenhum resumo encontrado.</div>';
}

function closeSelector() {
    one('#summaryModal')?.classList.add('hidden');
    if (!one('.modal-overlay:not(.hidden)')) document.body.classList.remove('modal-open');
    one('#summaryPicker')?.focus({ preventScroll: true });
}

async function openSelector() {
    try {
        await loadSummaries({ force: true });
        openScreen('dashboard');
        const search = one('#summarySearch');
        if (search) search.value = '';
        one('#summarySelectionMeta').textContent = `${summaries.length} ${summaries.length === 1 ? 'resumo disponível' : 'resumos disponíveis'}`;
        renderOptions();
        one('#summaryModal')?.classList.remove('hidden');
        document.body.classList.add('modal-open');
        one('#summaryModalClose')?.focus({ preventScroll: true });
    } catch (error) {
        notify(error.message, 5000);
    }
}

export function bindSummaryEvents() {
    one('#summaryPicker')?.addEventListener('click', openSelector);
    one('#summaryModalClose')?.addEventListener('click', closeSelector);
    one('#summarySearch')?.addEventListener('input', (event) => renderOptions(event.target.value));
    one('#summaryOptions')?.addEventListener('click', (event) => {
        if (event.target.closest('[data-summary-open]')) closeSelector();
    });
    one('#summaryModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'summaryModal') closeSelector();
    });
    document.addEventListener('summaries:changed', () => {
        summaries = [];
        one('#summarySelectionMeta').textContent = 'Toque para escolher';
    });
}
