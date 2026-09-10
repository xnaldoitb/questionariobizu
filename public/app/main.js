import { mountAdminInterface, mountInterface } from './foundation/fragments.js';
import { one, safeText, notify } from './foundation/selectors.js';
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
import { startProgression } from './domains/progression.js';
import { bindPaymentEvents, preloadPaymentPlans, startAccessIndicator } from './domains/access.js';
import { bindRewardEvents, checkRewardNotification } from './domains/rewards.js';
import { bindPatentEvents, checkPatentNotification } from './domains/patents.js';
import { ADMIN_PATENT, DEVELOPER_PATENT, patentButtonMarkup, patentForHits } from './foundation/patents.js';
import { bindPwaInstall } from './foundation/pwa.js';

const PROFILE_REFRESH_MS = 15_000;
let lastProfileRefresh = 0;
let lastProfilePatentLevel = null;
let managementPromise = null;

function canManage() {
    return ['admin', 'supremo'].includes(appState.user?.perfil);
}

async function ensureManagement() {
    if (!canManage()) throw new Error('Acesso restrito.');
    if (!managementPromise) {
        managementPromise = (async () => {
            await mountAdminInterface();
            const management = await import('./domains/management.js');
            onCatalogReady(management.renderManagedCatalog);
            management.bindManagementEvents();
            one('#adminSubject')?.addEventListener('change', () => {
                populateChapterSelector('#adminSubject', '#adminChapter', false);
            });
            management.applyManagementAccess();
            management.renderManagedCatalog();
            return management;
        })().catch((error) => {
            managementPromise = null;
            throw error;
        });
    }
    return managementPromise;
}

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
    const admin = appState.user?.perfil === 'admin';
    const institutional = developer || admin;
    const patent = developer ? DEVELOPER_PATENT : admin ? ADMIN_PATENT : patentForHits(hits);
    const advanced = !institutional && lastProfilePatentLevel !== null && patent.level > lastProfilePatentLevel;
    lastProfilePatentLevel = institutional ? -1 : patent.level;
    const icon = one('#profileAvatar');
    if (icon) {
        icon.innerHTML = patentButtonMarkup(hits, { developer, admin }).replace(/^<button[^>]*>|<\/button>$/g, '');
        icon.dataset.patentHits = String(hits);
        icon.dataset.developer = developer ? 'true' : 'false';
        icon.dataset.admin = admin ? 'true' : 'false';
        icon.setAttribute('aria-label', `Ver patente ${patent.name}`);
    }
    return advanced;
}

async function refreshProfileSummary({ force = false } = {}) {
    one('#profileWarName').innerHTML = `${safeText(appState.user.nome)} ${accountBadges(appState.user)}`;
    one('#profileKicker').textContent = roleConnectedLabel(appState.user.perfil);
    one('#profileRegistration').textContent = `AL SD PM Nº: ${appState.user.usuario}`;
    renderProfilePatent(Number(appState.user.xp_total || 0));

    if (!force && Date.now() - lastProfileRefresh < PROFILE_REFRESH_MS) return;

    try {
        const response = await fetch('/api/ranking?resumo=1', { credentials: 'same-origin' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.erro || 'Não foi possível carregar seu resumo.');
        const current = payload.resumo || null;

        one('#profileRanking').textContent = current?.posicao ? `${current.posicao}º` : '—';
        one('#profileAnswered').textContent = current?.respondidas || 0;
        one('#profileCorrect').textContent = current?.acertos || 0;
        const patentAdvanced = renderProfilePatent(current?.xp_total || 0);
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
    startProgression();
    one('#navAdmin')?.classList.toggle('hidden', !canManage());
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

    one('#navAdmin').addEventListener('click', async () => {
        const button = one('#navAdmin');
        button.disabled = true;
        try {
            const management = await ensureManagement();
            openScreen('adminView');
            await management.openManagementWorkspace();
        } catch (error) {
            notify(error.message || 'Não foi possível abrir a área administrativa.');
        } finally {
            button.disabled = false;
        }
    });

    one('#themeBtn').addEventListener('click', alternateTheme);

    document.addEventListener('quiz:progress-changed', async () => {
        const update = await refreshProfileSummary({ force: true });
        if (update?.patentAdvanced) checkPatentNotification();
    });
    document.addEventListener('quiz:xp-changed', (event) => {
        const total = Number(event.detail?.total || 0);
        appState.user.xp_total = total;
        const advanced = renderProfilePatent(total);
        if (advanced) checkPatentNotification();
    });
    document.addEventListener('quiz:access-changed', () => {
        one('#profileWarName').innerHTML = `${safeText(appState.user.nome)} ${accountBadges(appState.user)}`;
    });

    one('#subjectSelect').addEventListener('change', () => {
        populateChapterSelector('#subjectSelect', '#chapterSelect', true);
    });

}

async function bootstrap() {
    await mountInterface();
    restoreThemePreference();

    bindIdentityEvents(enterWorkspace);
    bindPrimaryNavigation();
    bindStudyFilterModals();
    bindStudyEvents();
    bindPerformanceEvents();
    bindPaymentEvents();
    bindRewardEvents();
    bindPatentEvents();
    bindPwaInstall();

    try {
        await recoverIdentity();
        await enterWorkspace();
    } catch {
        one('#loginView').classList.remove('hidden');
    }
}

bootstrap();
