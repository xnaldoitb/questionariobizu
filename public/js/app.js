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
    renderCatalogAdmin
} from './features/admin.js';

function applySavedTheme() {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
}

function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('theme', nextTheme);
}

async function enterApplication() {
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');

    $('#userName').textContent = state.user.nome;
    $('#userRole').textContent = state.user.perfil === 'admin'
        ? 'Administrador'
        : 'Aluno';

    $('#navAdmin').classList.toggle('hidden', state.user.perfil !== 'admin');

    await loadCatalog();
    showView('dashboard');
}

function bindNavigationEvents() {
    $('#navQuiz').addEventListener('click', () => showView('dashboard'));

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
