import { one, notify } from './selectors.js';

const APP_VERSION = '4.45.2';
const UPDATE_INTERVAL_MS = 15 * 60 * 1000;
const INSTALL_DISMISSED_KEY = 'bizu-install-dismissed-session';
let installPrompt = null;
let waitingWorker = null;
let refreshing = false;
let installPreparationFinished = false;

function captureInstallPrompt(event) {
    event.preventDefault();
    installPrompt = event;
    installPreparationFinished = true;
    updateInstallButton();
}

// Precisa ser registrado durante a avaliação do módulo. A interface é montada
// a partir de fragmentos e aguardar esse processo pode fazer o Chrome emitir o
// evento antes de o listener existir, principalmente em links abertos em nova aba.
window.addEventListener('beforeinstallprompt', captureInstallPrompt);

function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function updateInstallButton() {
    const button = one('#installAppBtn');
    const footer = one('#installAppFooter');
    if (!button) return;
    const dismissed = sessionStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
    const available = !isInstalled() && !dismissed;
    const preparing = available && !isIos() && !installPrompt && !installPreparationFinished;
    const label = button.querySelector('span:last-child');
    button.disabled = preparing;
    button.classList.toggle('is-preparing', preparing);
    if (label) label.textContent = preparing ? 'Preparando instalação…' : 'Instalar aplicativo';
    footer?.classList.toggle('hidden', !available);
    document.body.classList.toggle('pwa-install-available', available);
}

function showUpdate(worker) {
    waitingWorker = worker;
    one('#appUpdateNotice')?.classList.remove('hidden');
}

async function installApplication() {
    if (isInstalled()) return notify('O aplicativo já está instalado.');
    if (installPrompt) {
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        installPrompt = null;
        if (choice.outcome === 'accepted') sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1');
        updateInstallButton();
        notify(choice.outcome === 'accepted' ? 'Aplicativo instalado com sucesso.' : 'Instalação cancelada.');
    } else if (isIos()) {
        notify('No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.', 6500);
    } else {
        notify('Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.', 6500);
    }
}

function watchRegistration(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
    });
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    try {
        const registration = await navigator.serviceWorker.register(`/service-worker.js?v=${APP_VERSION}`, { scope: '/' });
        watchRegistration(registration);
        registration.update();
        window.setInterval(() => registration.update(), UPDATE_INTERVAL_MS);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') registration.update();
        });
    } catch (error) {
        console.error('Não foi possível ativar o modo aplicativo:', error);
    }
}

export function bindPwaInstall() {
    let alreadyControlled = Boolean(navigator.serviceWorker?.controller);
    one('#installAppBtn')?.addEventListener('click', installApplication);
    one('#installAppClose')?.addEventListener('click', () => {
        sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1');
        updateInstallButton();
    });
    one('#applyAppUpdate')?.addEventListener('click', () => {
        if (!waitingWorker) return window.location.reload();
        one('#applyAppUpdate').disabled = true;
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });
    one('#dismissAppUpdate')?.addEventListener('click', () => one('#appUpdateNotice')?.classList.add('hidden'));

    window.setTimeout(() => {
        installPreparationFinished = true;
        updateInstallButton();
    }, 4500);
    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1');
        updateInstallButton();
        notify('Questionário Bizu instalado com sucesso.');
    });
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
        if (!alreadyControlled) {
            alreadyControlled = true;
            return;
        }
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
    updateInstallButton();
    registerServiceWorker();
}
