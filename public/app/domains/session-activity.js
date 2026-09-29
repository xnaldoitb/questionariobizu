import { requestJson } from '../foundation/request.js';
import { appState } from '../foundation/model.js';

let onUser = () => {};
let lastActivity = Date.now();
let timer = null;
let inFlight = null;
let wasActive = false;

export function sessionIsActive() {
    return Boolean(appState.user) && document.visibilityState === 'visible' && Date.now() - lastActivity < 120000;
}

export async function syncSessionActivity({ interaction = false } = {}) {
    if (interaction) lastActivity = Date.now();
    if (inFlight) {
        const requestWasActive = wasActive;
        await inFlight;
        // Reaproveita a chamada corrente. Só envia outra quando ela registrou
        // inatividade e esta interação precisa reativar a sessão.
        if (!interaction || requestWasActive) return;
    }
    if (!appState.user) return;
    const active = sessionIsActive();
    if (!active && !wasActive) return;
    wasActive = active;
    inFlight = requestJson('acesso-atividade', { method: 'POST', body: JSON.stringify({ ativo: active }) })
        .then(data => { if (data.usuario) onUser(data.usuario); })
        .finally(() => { inFlight = null; });
    return inFlight;
}

function pauseOnExit() {
    if (!appState.user) return;
    wasActive = false;
    fetch('/api/acesso-atividade', {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ativo: false }),
    }).catch(() => {});
}

export function startSessionActivity(callback) {
    onUser = callback;
    if (timer) return;
    lastActivity = Date.now();
    const resume = () => syncSessionActivity().catch(() => {});
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(name => {
        window.addEventListener(name, () => {
            const idle = !sessionIsActive();
            lastActivity = Date.now();
            if (idle) resume();
        }, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') { lastActivity = Date.now(); resume(); }
        else pauseOnExit();
    });
    window.addEventListener('pagehide', pauseOnExit);
    window.addEventListener('pageshow', resume);
    // Um minuto preserva a contagem do teste sem bombardear a API quando
    // centenas de alunos estudam ao mesmo tempo.
    timer = window.setInterval(resume, 60000);
    resume();
}
