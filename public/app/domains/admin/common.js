import { one, all } from '../../foundation/selectors.js';
import { appState } from '../../foundation/model.js';

export const adminState = {
    users: [],
    administrators: [],
    catalog: { disciplinas: [], capitulos: [] },
    questions: [],
    questionsTotal: 0,
    questionPage: 1,
    questionPages: 1,
    plans: [],
    payments: [],
};

export function isSupreme() {
    return appState.user?.perfil === 'supremo';
}

export function isManager() {
    return ['admin', 'supremo'].includes(appState.user?.perfil);
}

export function formatDate(value, fallback = 'Sem prazo') {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function formatDateTime(value, fallback = 'Nunca') {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}

export function toDateInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function todayInput() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function datePlusDays(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + Number(days || 0));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function openAdminModal(id) {
    const modal = one(`#${id}`);
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('admin-modal-open');
}

export function closeAdminModal(id) {
    one(`#${id}`)?.classList.add('hidden');
    if (!document.querySelector('.admin-modal:not(.hidden)')) {
        document.body.classList.remove('admin-modal-open');
    }
}

export function bindAdminModalClosers() {
    all('[data-close-admin-modal]').forEach((button) => {
        button.addEventListener('click', () => closeAdminModal(button.dataset.closeAdminModal));
    });

    all('.admin-modal').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeAdminModal(modal.id);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const open = document.querySelector('.admin-modal:not(.hidden)');
        if (open) closeAdminModal(open.id);
    });
}
