import { one, notify } from './selectors.js';

let installPrompt = null;
let refreshing = false;

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
    const available = !isInstalled() && Boolean(installPrompt || isIos());
    footer?.classList.toggle('hidden', !available);
    document.body.classList.toggle('pwa-install-available', available);
}

async function installApplication() {
    if (isInstalled()) {
        notify('O aplicativo já está instalado.');
        return;
    }

    if (installPrompt) {
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        installPrompt = null;
        updateInstallButton();
        notify(choice.outcome === 'accepted' ? 'Aplicativo instalado com sucesso.' : 'Instalação cancelada.');
        return;
    }

    if (isIos()) {
        notify('No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.', 6500);
    }
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
        window.setInterval(() => registration.update(), 60 * 60 * 1000);
    } catch (error) {
        console.error('Não foi possível ativar o modo aplicativo:', error);
    }
}

export function bindPwaInstall() {
    let alreadyControlled = Boolean(navigator.serviceWorker?.controller);
    one('#installAppBtn')?.addEventListener('click', installApplication);

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        installPrompt = event;
        updateInstallButton();
    });

    window.addEventListener('appinstalled', () => {
        installPrompt = null;
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
