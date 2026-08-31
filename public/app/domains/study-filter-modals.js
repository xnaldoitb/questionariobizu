import { one, all } from '../foundation/selectors.js';

let activeTrigger = null;

function openFilterModal(modalSelector, trigger) {
    const modal = one(modalSelector);
    if (!modal) return;

    activeTrigger = trigger;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    if (modalSelector === '#subjectModal') {
        const search = one('#subjectSearch');
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
    }

    modal.querySelector('.study-modal-close')?.focus({ preventScroll: true });
}

function closeFilterModal(modalSelector) {
    const modal = one(modalSelector);
    if (!modal || modal.classList.contains('hidden')) return;

    modal.classList.add('hidden');
    if (!one('.modal-overlay:not(.hidden)')) document.body.classList.remove('modal-open');
    activeTrigger?.focus({ preventScroll: true });
    activeTrigger = null;
}

function bindModal(triggerSelector, modalSelector, closeSelectors) {
    const trigger = one(triggerSelector);
    const modal = one(modalSelector);
    trigger?.addEventListener('click', () => openFilterModal(modalSelector, trigger));
    closeSelectors.forEach((selector) => one(selector)?.addEventListener('click', () => closeFilterModal(modalSelector)));
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) closeFilterModal(modalSelector);
    });
}

export function bindStudyFilterModals() {
    bindModal('#subjectPicker', '#subjectModal', ['#subjectModalClose']);
    bindModal('#chapterPicker', '#chapterModal', ['#chapterModalClose', '#chapterDone']);

    document.addEventListener('study-filter:close', (event) => {
        if (event.detail?.id) closeFilterModal(`#${event.detail.id}`);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const visible = [...all('.study-filter-overlay:not(.hidden)')].at(-1);
        if (visible) closeFilterModal(`#${visible.id}`);
    });
}
