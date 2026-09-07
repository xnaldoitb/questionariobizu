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
import { bindStudyFilterModals } from './domains/study-filter-modals.js';
import { bindPerformanceEvents } from './domains/performance.js';
import { startCommunity } from './domains/community.js';
import { bindPaymentEvents, preloadPaymentPlans, startAccessIndicator } from './domains/access.js';
import { bindRewardEvents, checkRewardNotification } from './domains/rewards.js';
import { bindPatentEvents, checkPatentNotification } from './domains/patents.js';
import { DEVELOPER_PATENT, patentButtonMarkup, patentForHits } from './foundation/patents.js';
import { bindPwaInstall } from './foundation/pwa.js';
import {
    bindManagementEvents,
    renderManagedCatalog,
    applyManagementAccess,
    openManagementWorkspace
} from './domains/management.js';

const PROFILE_REFRESH_MS = 15_000;
let lastProfileRefresh = 0;
let lastProfilePatentLevel = null;

function refreshThemeControl() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const icon = document.querySelector('.theme-action-icon');
    const label = document.querySelector('.theme-action-label');

    if (icon) icon.textContent = dark ? '☀' : '☾';
    if (label) label.textContent = dark ? 'Modo claro' : 'Modo escuro';

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

function renderProfilePatent(hits = 0) {
    const developer = appState.user?.perfil === 'supremo';
    const patent = developer ? DEVELOPER_PATENT : patentForHits(hits);
    const advanced = !developer && lastProfilePatentLevel !== null && patent.level > lastProfilePatentLevel;
    lastProfilePatentLevel = developer ? -1 : patent.level;
    const icon = one('#profileAvatar');
    if (icon) {
        icon.innerHTML = patentButtonMarkup(hits, { developer }).replace(/^<button[^>]*>|<\/button>$/g, '');
        icon.dataset.patentHits = String(hits);
        icon.dataset.developer = developer ? 'true' : 'false';
        icon.setAttribute('aria-label', `Ver patente ${patent.name}`);
    }
    return advanced;
}

async function refreshProfileSummary({ force = false } = {}) {
    one('#profileWarName').innerHTML = `${safeText(appState.user.nome)} ${accountBadges(appState.user)}`;
    one('#profileKicker').textContent = roleConnectedLabel(appState.user.perfil);
    one('#profileRegistration').textContent = `AL SD PM Nº: ${appState.user.usuario}`;
    renderProfilePatent(Number(one('#profileCorrect')?.textContent || 0));

    if (!force && Date.now() - lastProfileRefresh < PROFILE_REFRESH_MS) return;

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
        const patentAdvanced = renderProfilePatent(current?.acertos || 0);
        lastProfileRefresh = Date.now();
        return { patentAdvanced };
    } catch {
        one('#profileRanking').textContent = '—';
    }
}

async function enterWorkspace() {
    one('#loginView').classList.add('hidden');
    one('#appView').classList.remove('hidden');

    preloadPaymentPlans().catch(() => {});
    await refreshProfileSummary();
    startAccessIndicator();
    startCommunity();
    applyManagementAccess();
    await refreshCatalog();
    openScreen('dashboard');
    checkRewardNotification().then((shown) => {
        if (!shown) checkPatentNotification();
    });
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

    document.addEventListener('quiz:progress-changed', async () => {
        const update = await refreshProfileSummary({ force: true });
        if (update?.patentAdvanced) checkPatentNotification();
    });
    document.addEventListener('quiz:access-changed', () => {
        one('#profileWarName').innerHTML = `${safeText(appState.user.nome)} ${accountBadges(appState.user)}`;
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
    bindStudyFilterModals();
    bindStudyEvents();
    bindPerformanceEvents();
    bindPaymentEvents();
    bindRewardEvents();
    bindPatentEvents();
    bindPwaInstall();
    bindManagementEvents();

    try {
        await recoverIdentity();
        await enterWorkspace();
    } catch {
        one('#loginView').classList.remove('hidden');
    }
}

bootstrap();
