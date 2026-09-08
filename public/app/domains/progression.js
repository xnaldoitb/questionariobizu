import { requestJson } from '../foundation/request.js';
import { one, safeText, notify } from '../foundation/selectors.js';
import { openCommunityChat, openCommunitySupport, openXpRulesTopic } from './community.js';

const REFRESH_MS = 45_000;
let initialized = false;
let timer = null;
let missionRefreshTimer = null;
let missionRequest = null;
let notifications = [];

function openModal(id) {
    const modal = one(`#${id}`);
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modal.querySelector('.progression-close')?.focus();
}

function closeModal(id) {
    one(`#${id}`)?.classList.add('hidden');
    if (!document.querySelector('.modal-overlay:not(.hidden)')) document.body.classList.remove('modal-open');
}

function updateCount(id, value) {
    const badge = one(`#${id}`);
    if (!badge) return;
    const total = Math.max(0, Number(value) || 0);
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.classList.toggle('hidden', total === 0);
}

function relativeTime(value) {
    const date = new Date(value);
    const delta = Date.now() - date.getTime();
    if (!Number.isFinite(delta)) return '';
    if (delta < 60_000) return 'agora';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} h`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const notificationSymbols = {
    suporte: '?', chat_privado: '◌', vencimento: '!', missao: '✓', patente: '★', plano: '◆', sistema: 'i',
};

function renderNotifications() {
    const list = one('#notificationsList');
    if (!list) return;
    if (!notifications.length) {
        list.innerHTML = '<div class="progression-empty"><strong>Tudo em dia</strong><span>Você ainda não recebeu notificações.</span></div>';
        return;
    }
    list.innerHTML = notifications.map((item) => `<button class="notification-item ${item.lida_em ? '' : 'is-unread'}" type="button" data-notification-id="${item.id}">
        <span class="notification-symbol type-${item.tipo}" aria-hidden="true">${notificationSymbols[item.tipo] || 'i'}</span>
        <span class="notification-copy"><strong>${safeText(item.titulo)}</strong><span>${safeText(item.mensagem)}</span><small>${safeText(relativeTime(item.criado_em))}</small></span>
        ${item.lida_em ? '' : '<i class="notification-unread" aria-label="Não lida"></i>'}
    </button>`).join('');
}

async function loadNotifications({ quiet = false } = {}) {
    try {
        const payload = await requestJson('notificacoes');
        notifications = payload.notificacoes || [];
        updateCount('notificationCount', payload.nao_lidas);
        one('#notificationsStatus').textContent = payload.nao_lidas
            ? `${payload.nao_lidas} ${payload.nao_lidas === 1 ? 'aviso não lido' : 'avisos não lidos'}`
            : 'Nenhum aviso pendente';
        renderNotifications();
    } catch (error) {
        if (!quiet) {
            one('#notificationsList').innerHTML = '<div class="progression-empty">Não foi possível carregar as notificações.</div>';
            notify(error.message);
        }
    }
}

async function openNotifications() {
    openModal('notificationsModal');
    one('#notificationsList').innerHTML = '<div class="progression-empty">Carregando notificações…</div>';
    await loadNotifications();
}

async function markNotification(item) {
    if (!item.lida_em) {
        await requestJson('notificacoes', { method: 'POST', body: JSON.stringify({ acao: 'marcar_lida', id: item.id }) });
        item.lida_em = new Date().toISOString();
        updateCount('notificationCount', notifications.filter((entry) => !entry.lida_em).length);
        renderNotifications();
    }
    closeModal('notificationsModal');
    if (item.acao === 'suporte') await openCommunitySupport(item.referencia_id);
    else if (item.acao === 'chat') await openCommunityChat(item.referencia_id);
    else if (item.acao === 'missoes') await openMissions();
    else if (item.acao === 'pagamentos') one('#accountPlansBtn')?.click();
    else if (item.acao === 'patente') one('#profileAvatar')?.click();
}

async function markAll() {
    await requestJson('notificacoes', { method: 'POST', body: JSON.stringify({ acao: 'marcar_todas' }) });
    notifications = notifications.map((item) => ({ ...item, lida_em: item.lida_em || new Date().toISOString() }));
    updateCount('notificationCount', 0);
    one('#notificationsStatus').textContent = 'Nenhum aviso pendente';
    renderNotifications();
}

function renderMissions(payload) {
    const patent = payload.patente || {};
    one('#missionsXp').textContent = `${Number(payload.xp_total || 0).toLocaleString('pt-BR')} XP`;
    one('#missionsPatent').textContent = patent.nome || '—';
    one('#missionsPatentProgress').style.width = `${Number(patent.progresso || 0)}%`;
    one('#missionsNextPatent').textContent = patent.proxima
        ? `${Number(patent.faltam || 0).toLocaleString('pt-BR')} XP para ${patent.proxima}`
        : 'Patente máxima alcançada';
    const missions = payload.missoes || [];
    updateCount('missionCount', payload.concluidas_no_ciclo ?? missions.filter((item) => item.concluida).length);
    let currentGroup = '';
    one('#missionsList').innerHTML = missions.map((mission) => {
        const calculatedProgress = Math.round((Number(mission.atual || 0) / Math.max(Number(mission.meta || 1), 1)) * 100);
        const progress = mission.concluida ? 100 : Math.min(100, Number(mission.progresso ?? calculatedProgress));
        const group = mission.grupo || 'Missões';
        const groupHeader = group !== currentGroup
            ? `<h3 class="mission-group-title"><span>${safeText(group)}</span><small>${group === 'Diárias' ? 'renovam diariamente' : 'segunda a domingo'}</small></h3>`
            : '';
        currentGroup = group;
        const stages = Number(mission.etapas_concluidas || 0);
        const stageLabel = stages ? `<em>${stages} ${stages === 1 ? 'etapa concluída' : 'etapas concluídas'}</em>` : '';
        return `${groupHeader}<article class="mission-item ${mission.concluida ? 'is-complete' : ''} ${mission.premiada ? 'is-newly-complete' : ''}">
            <span class="mission-check" aria-hidden="true">${mission.concluida ? '✓' : (stages || '')}</span>
            <div class="mission-copy"><div><strong>${safeText(mission.titulo)}</strong><b>+${mission.pontos} XP</b></div><span>${safeText(mission.descricao)}</span>
                <div class="mission-progress"><i style="width:${progress}%"></i></div><footer>${stageLabel}<small>${mission.atual}/${mission.meta} ${safeText(mission.unidade || '')}</small></footer>
            </div>
        </article>`;
    }).join('') || '<div class="progression-empty">Nenhuma missão disponível.</div>';
}

async function loadMissions({ quiet = false } = {}) {
    if (missionRequest) return missionRequest;
    missionRequest = (async () => {
        try { renderMissions(await requestJson('missoes')); }
        catch (error) {
            if (!quiet) {
                one('#missionsList').innerHTML = `<div class="progression-empty"><strong>Não foi possível carregar as missões</strong><span>${safeText(error.message)}</span><button class="mission-rules-link" id="missionsRetry" type="button">Tentar novamente</button></div>`;
                notify(error.message);
            }
        } finally {
            missionRequest = null;
        }
    })();
    return missionRequest;
}

function scheduleMissionRefresh() {
    clearTimeout(missionRefreshTimer);
    missionRefreshTimer = setTimeout(() => loadMissions({ quiet: true }), 900);
}

async function openMissions() {
    openModal('missionsModal');
    one('#missionsList').innerHTML = '<div class="progression-empty">Carregando missões…</div>';
    await loadMissions();
}

function bindUi() {
    one('#notificationsBtn')?.addEventListener('click', openNotifications);
    one('#missionsBtn')?.addEventListener('click', openMissions);
    one('#quizNotificationsBtn')?.addEventListener('click', openNotifications);
    one('#quizMissionsBtn')?.addEventListener('click', openMissions);
    one('#notificationsClose')?.addEventListener('click', () => closeModal('notificationsModal'));
    one('#missionsClose')?.addEventListener('click', () => closeModal('missionsModal'));
    one('#markAllNotifications')?.addEventListener('click', () => markAll().catch((error) => notify(error.message)));
    one('#missionsList')?.addEventListener('click', (event) => {
        if (!event.target.closest('#missionsRetry')) return;
        one('#missionsList').innerHTML = '<div class="progression-empty">Carregando missões…</div>';
        loadMissions();
    });
    one('#notificationsList')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-notification-id]');
        const item = notifications.find((entry) => String(entry.id) === button?.dataset.notificationId);
        if (item) markNotification(item).catch((error) => notify(error.message));
    });
    one('#openXpRulesTopic')?.addEventListener('click', async () => {
        closeModal('missionsModal');
        await openXpRulesTopic();
    });
    ['notificationsModal', 'missionsModal'].forEach((id) => one(`#${id}`)?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeModal(id);
    }));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal('notificationsModal');
            closeModal('missionsModal');
        }
    });
    document.addEventListener('quiz:progress-changed', scheduleMissionRefresh);
    document.addEventListener('quiz:xp-changed', scheduleMissionRefresh);
}

export function startProgression() {
    if (!initialized) {
        initialized = true;
        bindUi();
    }
    loadNotifications({ quiet: true });
    loadMissions({ quiet: true });
    clearInterval(timer);
    timer = setInterval(() => document.visibilityState === 'visible' && loadNotifications({ quiet: true }), REFRESH_MS);
}
