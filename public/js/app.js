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

function updateThemeControl() {
    const darkMode = document.documentElement.dataset.theme === 'dark';
    const label = $('#themeButtonLabel');
    const button = $('#themeBtn');

    if (label) {
        label.textContent = darkMode ? 'Modo claro' : 'Modo escuro';
    }

    if (button) {
        button.setAttribute('aria-label', darkMode ? 'Ativar modo claro' : 'Ativar modo escuro');
        button.setAttribute('aria-pressed', String(darkMode));
    }
}

function applySavedTheme() {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
    updateThemeControl();
}

function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('theme', nextTheme);
    updateThemeControl();
}

function setMobileMenu(open) {
    const header = $('#siteHeader');
    const toggle = $('#menuToggle');

    if (!header || !toggle) {
        return;
    }

    header.classList.toggle('menu-open', open);
    document.body.classList.toggle('menu-locked', open);
    toggle.setAttribute('aria-expanded', String(open));
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
    $('#brandHome')?.addEventListener('click', (event) => {
        event.preventDefault();
        showView('dashboard');
        setMobileMenu(false);
    });

    $('#menuToggle')?.addEventListener('click', () => {
        setMobileMenu(!$('#siteHeader').classList.contains('menu-open'));
    });

    $('#menuClose')?.addEventListener('click', () => setMobileMenu(false));
    $('#menuBackdrop')?.addEventListener('click', () => setMobileMenu(false));

    $('#navQuiz').addEventListener('click', () => {
        showView('dashboard');
        setMobileMenu(false);
    });

    $('#navAdmin').addEventListener('click', async () => {
        showView('adminView');
        await loadUsers();
        setMobileMenu(false);
    });

    $('#themeBtn').addEventListener('click', toggleTheme);

    document.querySelectorAll('.main-navigation .nav-btn').forEach((button) => {
        button.addEventListener('click', () => setMobileMenu(false));
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            setMobileMenu(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setMobileMenu(false);
        }
    });

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
