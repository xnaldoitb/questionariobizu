export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[character]);
}

export function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');

    window.setTimeout(() => {
        element.classList.remove('show');
    }, 2800);
}
