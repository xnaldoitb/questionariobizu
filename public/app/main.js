import { mountInterface } from './foundation/fragments.js';
import { one, safeText } from './foundation/selectors.js';
import { appState } from './foundation/model.js';
import { accountBadges, roleConnectedLabel } from './foundation/badges.js';
import { openScreen } from './foundation/navigation.js';
import { bindIdentityEvents, recoverIdentity } from './domains/identity.js';
import {
    populateChapterSelector,
    refreshCatalog,
    onCatalogReady
} from './domains/catalog.js';
import { bindStudyEvents } from './domains/study.js';
import { bindPerformanceEvents } from './domains/performance.js';
import {
    bindManagementEvents,
    renderManagedCatalog,
    applyManagementAccess,
    openManagementWorkspace
} from './domains/management.js';

function refreshThemeControl() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const icon = document.querySelector('.theme-action-icon');

    if (icon) icon.textContent = dark ? '☀' : '☾';

    one('#themeBtn')?.setAttribute(
        'aria-label',
        dark ? 'Ativar modo claro' : 'Ativar modo escuro'
    );
}

function restoreThemePreference() {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
    refreshThemeControl();
}

function alternateTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const next = dark ? 'light' : 'dark';

    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    refreshThemeControl();
}

function initials(name = '') {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] || '')
        .join('')
        .toUpperCase() || 'AL';
}

async function refreshProfileSummary() {
    one('#profileWarName').innerHTML = `${safeText(appState.user.nome)} ${accountBadges(appState.user)}`;
    one('#profileKicker').textContent = roleConnectedLabel(appState.user.perfil);
    one('#profileRegistration').textContent = `AL SD PM Nº: ${appState.user.usuario}`;
    one('#profileAvatar').textContent = initials(appState.user.nome);

    try {
        const response = await fetch('/api/ranking', { credentials: 'same-origin' });
        const payload = await response.json();
        const ranking = payload.ranking || [];
        const index = ranking.findIndex(
            (entry) =>
                entry.usuario_id === appState.user.id ||
                entry.usuario === appState.user.usuario
        );
        const current = index >= 0 ? ranking[index] : null;

        one('#profileRanking').textContent = index >= 0 ? `${index + 1}º` : '—';
        one('#profileAnswered').textContent = current?.respondidas || 0;
        one('#profileCorrect').textContent = current?.acertos || 0;
    } catch {
        one('#profileRanking').textContent = '—';
    }
}

async function enterWorkspace() {
    one('#loginView').classList.add('hidden');
    one('#appView').classList.remove('hidden');

    await refreshProfileSummary();
    applyManagementAccess();
    await refreshCatalog();
    openScreen('dashboard');
}

function bindPrimaryNavigation() {
    one('#navHome').addEventListener('click', () => {
        refreshProfileSummary();
        openScreen('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    one('#navQuiz').addEventListener('click', () => {
        refreshProfileSummary();
        openScreen('dashboard');
        document.querySelector('.study-panel')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    });

    one('#navAdmin').addEventListener('click', async () => {
        openScreen('adminView');
        await openManagementWorkspace();
    });

    one('#themeBtn').addEventListener('click', alternateTheme);

    document.addEventListener('quiz:progress-changed', () => {
        refreshProfileSummary();
    });

    one('#subjectSelect').addEventListener('change', () => {
        populateChapterSelector('#subjectSelect', '#chapterSelect', true);
    });

    one('#adminSubject').addEventListener('change', () => {
        populateChapterSelector('#adminSubject', '#adminChapter', false);
    });
}

async function bootstrap() {
    await mountInterface();
    restoreThemePreference();
    onCatalogReady(renderManagedCatalog);

    bindIdentityEvents(enterWorkspace);
    bindPrimaryNavigation();
    bindStudyEvents();
    bindPerformanceEvents();
    bindManagementEvents();

    try {
        await recoverIdentity();
        await enterWorkspace();
    } catch {
        one('#loginView').classList.remove('hidden');
    }
}

bootstrap();
