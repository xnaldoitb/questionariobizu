export function one(selector, root = document) {
    return root.querySelector(selector);
}

export function all(selector, root = document) {
    return root.querySelectorAll(selector);
}

export function safeText(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[character]);
}

export function notify(message, duration = 2800) {
    const toast = one('#toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    window.setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}
