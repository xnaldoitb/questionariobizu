import { loadApplicationComponents } from './core/components.js';
import { $ } from './core/dom.js';
import { state } from './core/state.js';
import { showView } from './core/views.js';
import { bindAuthEvents, restoreSession } from './features/auth.js';
import {
    fillChapterSelect,
    loadCatalog,
    setCatalogLoadedHandler
} from './features/catalog.js';
import { bindQuizEvents } from './features/quiz.js';
import { bindReportEvents } from './features/reports.js';
import {
    bindAdminEvents,
    loadUsers,
    renderCatalogAdmin,
    configureAdminAccess
} from './features/admin.js';

function updateThemeButton() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const icon = document.querySelector('.theme-action-icon');
    if (icon) icon.textContent = isDark ? '☀' : '☾';
    document.querySelector('#themeBtn')?.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
}

function applySavedTheme() {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
    updateThemeButton();
}

function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('theme', nextTheme);
    updateThemeButton();
}


function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'AL';
}

async function loadProfileDashboard() {
    $('#profileWarName').textContent = state.user.nome;
    $('#profileRegistration').textContent = `AL SD PM Nº: ${state.user.usuario}`;
    $('#profileAvatar').textContent = initials(state.user.nome);

    try {
        const rankingData = await fetch('/api/ranking', {
            credentials: 'same-origin'
        }).then((response) => response.json());

        const ranking = rankingData.ranking || [];
        const position = ranking.findIndex(
            (entry) => entry.usuario_id === state.user.id || entry.usuario === state.user.usuario
        );
        const mine = position >= 0 ? ranking[position] : null;

        $('#profileRanking').textContent = position >= 0 ? `${position + 1}º` : '—';
        $('#profileAnswered').textContent = mine?.respondidas || 0;
        $('#profileCorrect').textContent = mine?.acertos || 0;
    } catch {
        $('#profileRanking').textContent = '—';
    }
}

async function enterApplication() {
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');

    await loadProfileDashboard();

    configureAdminAccess();

    await loadCatalog();
    showView('dashboard');
}

function bindNavigationEvents() {
    $('#navHome').addEventListener('click', () => {
        showView('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    $('#navQuiz').addEventListener('click', () => {
        showView('dashboard');
        document.querySelector('.study-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#navAdmin').addEventListener('click', async () => {
        showView('adminView');
        await loadUsers();
    });

    $('#themeBtn').addEventListener('click', toggleTheme);

    $('#subjectSelect').addEventListener('change', () => {
        fillChapterSelect('#subjectSelect', '#chapterSelect', true);
    });

    $('#adminSubject').addEventListener('change', () => {
        fillChapterSelect('#adminSubject', '#adminChapter', false);
    });
}

async function initialize() {
    await loadApplicationComponents();
    applySavedTheme();
    setCatalogLoadedHandler(renderCatalogAdmin);

    bindAuthEvents(enterApplication);
    bindNavigationEvents();
    bindQuizEvents();
    bindReportEvents();
    bindAdminEvents();

    try {
        await restoreSession();
        await enterApplication();
    } catch {
        $('#loginView').classList.remove('hidden');
    }
}

initialize();
