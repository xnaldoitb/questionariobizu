import { requestJson } from '../foundation/request.js';
import { accountBadges } from '../foundation/badges.js';
import { appState } from '../foundation/model.js';
import { one, safeText, notify } from '../foundation/selectors.js';

const HEARTBEAT_MS = 90_000;
const PRESENCE_REFRESH_MS = 60_000;
const CHAT_REFRESH_MS = 10_000;
const ACTIVITY_PING_THROTTLE_MS = 30_000;
const SPOTLIGHT_ROTATION_MS = 8_000;

let initialized = false;
let onlineUsers = [];
let lastSpotlightId = null;
let lastActivityPing = 0;
let heartbeatTimer = null;
let presenceTimer = null;
let spotlightTimer = null;
let chatTimer = null;
let chatOpen = false;

function openChatModal() {
    const modal = one('#chatModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    chatOpen = true;
    sendActivityPing();
    refreshChat({ quiet: false });
    one('#chatInput')?.focus();
    clearInterval(chatTimer);
    chatTimer = window.setInterval(() => refreshChat({ quiet: true }), CHAT_REFRESH_MS);
}

function closeChatModal() {
    one('#chatModal')?.classList.add('hidden');
    chatOpen = false;
    clearInterval(chatTimer);
    chatTimer = null;
    if (!document.querySelector('.modal-overlay:not(.hidden)')) {
        document.body.classList.remove('modal-open');
    }
}

function updatePresence(payload = {}) {
    const count = Number(payload.online || 0);
    onlineUsers = Array.isArray(payload.usuarios) ? payload.usuarios : [];

    if (one('#onlineCount')) {
        one('#onlineCount').textContent = `${count} ${count === 1 ? 'online agora' : 'online agora'}`;
    }
    if (one('#chatOnlineCount')) one('#chatOnlineCount').textContent = String(count);
    if (one('#chatHeaderOnline')) one('#chatHeaderOnline').textContent = `${count} online`;

    rotateSpotlight();
}

function rotateSpotlight() {
    const target = one('#onlineSpotlight');
    if (!target) return;

    if (!onlineUsers.length) {
        target.textContent = 'Nenhum usuário ativo neste momento';
        lastSpotlightId = null;
        return;
    }

    const others = onlineUsers.filter((user) => user.id !== appState.user?.id);
    const pool = others.length ? others : onlineUsers;
    const alternatives = pool.filter((user) => user.id !== lastSpotlightId);
    const candidates = alternatives.length ? alternatives : pool;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    if (!chosen) return;
    lastSpotlightId = chosen.id;

    const own = chosen.id === appState.user?.id;
    target.innerHTML = own
        ? `Você está online ${accountBadges(chosen)}`
        : `${safeText(chosen.nome)} está online ${accountBadges(chosen)}`;
}

async function sendPresence({ activity = false } = {}) {
    try {
        const payload = await requestJson('presenca', {
            method: 'POST',
            body: JSON.stringify({ atividade: Boolean(activity) }),
        });
        updatePresence(payload);
    } catch {
        // Presença é complementar e não deve interromper o estudo.
    }
}

async function refreshPresence() {
    try {
        updatePresence(await requestJson('presenca'));
    } catch {
        if (one('#onlineSpotlight')) one('#onlineSpotlight').textContent = 'Presença temporariamente indisponível';
    }
}

function sendActivityPing() {
    const now = Date.now();
    if (now - lastActivityPing < ACTIVITY_PING_THROTTLE_MS) return;
    lastActivityPing = now;
    sendPresence({ activity: true });
}

function bindActivityTracking() {
    const activity = () => {
        if (document.visibilityState === 'visible') sendActivityPing();
    };

    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => {
        window.addEventListener(eventName, activity, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') sendActivityPing();
    });

    window.addEventListener('pagehide', () => {
        try {
            fetch('/api/presenca', {
                method: 'DELETE',
                credentials: 'include',
                keepalive: true,
            });
        } catch {
            // A limpeza automática do servidor cobre fechamentos abruptos.
        }
    });
}

function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function renderChat(messages = []) {
    const list = one('#chatMessages');
    if (!list) return;

    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;

    if (!messages.length) {
        list.innerHTML = '<div class="chat-empty">A sala está vazia. Envie a primeira mensagem.</div>';
        return;
    }

    list.innerHTML = messages.map((item) => {
        const own = item.usuario_id === appState.user?.id;
        const author = item.usuario || {};
        return `
            <article class="chat-message ${own ? 'is-own' : ''}">
                <div class="chat-message-head">
                    <strong>${safeText(own ? 'Você' : (author.nome || 'Usuário'))}</strong>
                    ${accountBadges(author)}
                    <time datetime="${safeText(item.criado_em)}">${safeText(formatTime(item.criado_em))}</time>
                </div>
                <p>${safeText(item.mensagem).replace(/\n/g, '<br>')}</p>
            </article>
        `;
    }).join('');

    if (nearBottom || !list.dataset.loaded) {
        list.scrollTop = list.scrollHeight;
    }
    list.dataset.loaded = '1';
}

async function refreshChat({ quiet = true } = {}) {
    if (!chatOpen) return;
    try {
        const payload = await requestJson('chat');
        if (one('#chatHeaderOnline')) one('#chatHeaderOnline').textContent = `${Number(payload.online || 0)} online`;
        renderChat(payload.mensagens || []);
    } catch (error) {
        if (!quiet) {
            one('#chatMessages').innerHTML = '<div class="chat-empty">Não foi possível carregar o chat.</div>';
            notify(error.message);
        }
    }
}

async function submitChat(event) {
    event.preventDefault();
    const input = one('#chatInput');
    const button = one('#chatSend');
    const message = input.value.trim();
    if (!message) return;

    button.disabled = true;
    try {
        await requestJson('chat', {
            method: 'POST',
            body: JSON.stringify({ mensagem: message }),
        });
        input.value = '';
        one('#chatCounter').textContent = '0/400';
        lastActivityPing = Date.now();
        await Promise.all([refreshChat({ quiet: true }), refreshPresence()]);
        input.focus();
    } catch (error) {
        notify(error.message);
    } finally {
        button.disabled = false;
    }
}

function bindChat() {
    one('#openChatBtn')?.addEventListener('click', openChatModal);
    one('#chatClose')?.addEventListener('click', closeChatModal);
    one('#chatModal')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeChatModal();
    });
    one('#chatForm')?.addEventListener('submit', submitChat);
    one('#chatInput')?.addEventListener('input', (event) => {
        one('#chatCounter').textContent = `${event.currentTarget.value.length}/400`;
    });
    one('#chatInput')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            one('#chatForm')?.requestSubmit();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && chatOpen) closeChatModal();
    });
}

export function startCommunity() {
    if (initialized) {
        sendActivityPing();
        refreshPresence();
        return;
    }
    initialized = true;

    bindChat();
    bindActivityTracking();
    sendActivityPing();
    refreshPresence();

    heartbeatTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') sendPresence({ activity: false });
    }, HEARTBEAT_MS);

    presenceTimer = window.setInterval(refreshPresence, PRESENCE_REFRESH_MS);
    spotlightTimer = window.setInterval(rotateSpotlight, SPOTLIGHT_ROTATION_MS);
}
