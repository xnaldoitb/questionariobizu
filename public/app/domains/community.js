import { requestJson } from '../foundation/request.js';
import { accountBadges } from '../foundation/badges.js';
import { appState } from '../foundation/model.js';
import { one, safeText, notify } from '../foundation/selectors.js';
import { bindEmojiPicker, countGraphemes } from './emoji-picker.js';
import { ADMIN_PATENT, DEVELOPER_PATENT, PATENTS, patentInsigniaMarkup } from '../foundation/patents.js';

const GENERAL_ROOM_ID = '00000000-0000-4000-8000-000000000001';
const HEARTBEAT_MS = 90_000;
const PRESENCE_REFRESH_MS = 60_000;
const CHAT_REFRESH_MS = 10_000;
const SUPPORT_REFRESH_MS = 12_000;
const ACTIVITY_PING_THROTTLE_MS = 30_000;
const PATENT_GUIDE_TOPIC_ID = 'guia-patentes';
const XP_RULES_TOPIC_ID = 'regras-xp';

let initialized = false;
let onlineUsers = [];
let lastActivityPing = 0;
let heartbeatTimer;
let presenceTimer;
let spotlightTimer;
let communityTimer;
let activeModal = null;
let rooms = [];
let currentRoomId = GENERAL_ROOM_ID;
let supportConversationId = null;
let activeTopicId = null;

function formatTime(value, includeDate = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', includeDate
        ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' });
}

function openModal(id) {
    const modal = one(`#${id}`);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('community-open');
    document.body.classList.add('modal-open');
    activeModal = id;
}

function closeModal(id) {
    const modal = one(`#${id}`);
    modal?.classList.add('hidden');
    modal?.classList.remove('community-open');
    if (activeModal === id) activeModal = null;
    clearInterval(communityTimer);
    communityTimer = null;
    if (!document.querySelector('.modal-overlay:not(.hidden)')) document.body.classList.remove('modal-open');
}

function updatePresence(payload = {}) {
    const count = Number(payload.online || 0);
    onlineUsers = Array.isArray(payload.usuarios) ? payload.usuarios : onlineUsers;
    if (one('#onlineCount')) one('#onlineCount').textContent = `${count} online agora`;
    if (one('#chatOnlineCount')) one('#chatOnlineCount').textContent = String(count);
    if (one('#chatHeaderOnline')) one('#chatHeaderOnline').textContent = `${count} online`;
    rotateSpotlight();
}

function rotateSpotlight() {
    const target = one('#onlineSpotlight');
    if (!target) return;
    if (!onlineUsers.length) {
        target.textContent = 'Comunidade disponível';
        return;
    }
    const pool = onlineUsers.filter((user) => !user.proprio);
    const candidates = pool.length ? pool : onlineUsers;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const own = Boolean(chosen?.proprio);
    target.innerHTML = chosen ? `${own ? 'Você' : safeText(chosen.nome)} está online ${accountBadges(chosen)}` : 'Comunidade disponível';
}

async function sendPresence({ activity = false } = {}) {
    try {
        updatePresence(await requestJson('presenca', { method: 'POST', body: JSON.stringify({ atividade: Boolean(activity) }) }));
    } catch { /* Presença não interrompe o estudo. */ }
}

async function refreshPresence() {
    try { updatePresence(await requestJson('presenca')); }
    catch { if (one('#onlineSpotlight')) one('#onlineSpotlight').textContent = 'Comunidade disponível'; }
}

function sendActivityPing() {
    if (Date.now() - lastActivityPing < ACTIVITY_PING_THROTTLE_MS) return;
    lastActivityPing = Date.now();
    sendPresence({ activity: true });
}

function renderMessages(target, messages, { support = false } = {}) {
    const list = one(target);
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
    if (!messages.length) {
        list.innerHTML = `<div class="chat-empty">${support ? 'Envie uma mensagem para iniciar o atendimento.' : 'Nenhuma mensagem nesta sala.'}</div>`;
        return;
    }
    list.innerHTML = messages.map((item) => {
        const author = support ? (item.usuarios || {}) : (item.usuario || {});
        const own = Boolean(item.propria);
        return `<article class="chat-message ${own ? 'is-own' : ''}">
            <div class="chat-message-head"><strong>${safeText(own ? 'Você' : (author.nome || 'Usuário'))}</strong>${accountBadges(author)}<time>${safeText(formatTime(item.criado_em))}</time></div>
            <p>${safeText(item.mensagem).replace(/\n/g, '<br>')}</p>
        </article>`;
    }).join('');
    if (nearBottom || !list.dataset.loaded) list.scrollTop = list.scrollHeight;
    list.dataset.loaded = '1';
}

function renderRooms() {
    const target = one('#chatRoomList');
    if (!target) return;
    target.innerHTML = rooms.map((room) => `<button class="chat-room-item ${room.id === currentRoomId ? 'is-active' : ''}" type="button" data-room-id="${room.id}">
        <span class="room-color room-${room.tipo}" aria-hidden="true"></span><span><strong>${safeText(room.nome)}</strong><small>${room.tipo === 'privada' ? 'Privada' : 'Pública'}</small></span>
    </button>`).join('') || '<div class="chat-empty">Nenhuma sala disponível.</div>';
}

async function loadRooms() {
    const payload = await requestJson('chat-salas');
    rooms = payload.salas || [];
    if (!rooms.some((room) => room.id === currentRoomId)) currentRoomId = rooms[0]?.id || GENERAL_ROOM_ID;
    renderRooms();
}

async function refreshChat({ quiet = true } = {}) {
    if (activeModal !== 'chatModal') return;
    try {
        const payload = await requestJson(`chat?sala=${encodeURIComponent(currentRoomId)}`);
        const room = payload.sala || rooms.find((item) => item.id === currentRoomId) || {};
        one('#chatRoomName').textContent = room.nome || 'Sala';
        one('#chatRoomPrivacy').textContent = room.tipo === 'privada' ? 'Sala privada' : 'Sala pública';
        updatePresence({ online: payload.online });
        renderMessages('#chatMessages', payload.mensagens || []);
    } catch (error) { if (!quiet) notify(error.message); }
}

export async function openCommunityChat(roomId = null) {
    if (roomId) currentRoomId = String(roomId);
    openModal('chatModal');
    try { await loadRooms(); await refreshChat({ quiet: false }); }
    catch (error) { notify(error.message); }
    one('#chatInput')?.focus();
    clearInterval(communityTimer);
    communityTimer = setInterval(() => refreshChat({ quiet: true }), CHAT_REFRESH_MS);
}

async function submitChat(event) {
    event.preventDefault();
    const input = one('#chatInput');
    const message = input.value.trim();
    if (!message) return;
    if (countGraphemes(message) > 400) return notify('A mensagem pode ter no máximo 400 caracteres.');
    one('#chatSend').disabled = true;
    try {
        await requestJson('chat', { method: 'POST', body: JSON.stringify({ sala_id: currentRoomId, mensagem: message }) });
        input.value = '';
        one('#chatCounter').textContent = '0/400';
        await refreshChat();
    } catch (error) { notify(error.message); }
    finally { one('#chatSend').disabled = false; }
}

async function createRoom(event) {
    event.preventDefault();
    try {
        const payload = await requestJson('chat-salas', { method: 'POST', body: JSON.stringify({
            nome: one('#chatRoomNameInput').value,
            tipo: one('#chatRoomType').value,
            participantes: one('#chatRoomParticipants').value,
        }) });
        currentRoomId = payload.sala.id;
        event.currentTarget.reset();
        one('#chatRoomParticipants').classList.add('hidden');
        one('#chatRoomForm').classList.add('hidden');
        await loadRooms();
        await refreshChat({ quiet: false });
    } catch (error) { notify(error.message); }
}

function renderSupportConversations(items) {
    const list = one('#supportConversations');
    if (!list) return;
    list.classList.remove('hidden');
    list.innerHTML = items.map((item) => `<button type="button" class="support-conversation ${item.id === supportConversationId ? 'is-active' : ''}" data-support-id="${item.id}">
        <strong>${safeText(item.usuarios?.nome || 'Aluno')}</strong><small>${safeText(item.usuarios?.usuario || '')} · ${safeText(item.status)}</small>
    </button>`).join('') || '<div class="chat-empty">Nenhum atendimento.</div>';
}

async function loadSupport({ quiet = false } = {}) {
    try {
        if (appState.user?.perfil === 'supremo') {
            const directory = await requestJson('suporte?listar=1');
            if (!supportConversationId) supportConversationId = directory.conversas?.[0]?.id || null;
            renderSupportConversations(directory.conversas || []);
        }
        const query = supportConversationId ? `?conversa_id=${encodeURIComponent(supportConversationId)}` : '';
        const payload = await requestJson(`suporte${query}`);
        supportConversationId = payload.conversa?.id || supportConversationId;
        renderMessages('#supportMessages', payload.mensagens || [], { support: true });
    } catch (error) { if (!quiet) notify(error.message); }
}

export async function openCommunitySupport(conversationId = null) {
    if (conversationId) supportConversationId = String(conversationId);
    openModal('supportModal');
    await loadSupport();
    one('#supportInput')?.focus();
    clearInterval(communityTimer);
    communityTimer = setInterval(() => activeModal === 'supportModal' && loadSupport({ quiet: true }), SUPPORT_REFRESH_MS);
}

async function submitSupport(event) {
    event.preventDefault();
    const input = one('#supportInput');
    try {
        await requestJson('suporte', { method: 'POST', body: JSON.stringify({ conversa_id: supportConversationId, mensagem: input.value }) });
        input.value = '';
        await loadSupport();
    } catch (error) { notify(error.message); }
}

const categoryNames = { duvida: 'Dúvida', discussao: 'Discussão', estudo: 'Estudo', aviso: 'Aviso' };

function renderTopics(items) {
    const list = one('#topicList');
    list.classList.remove('hidden');
    const xpGuide = `<button class="topic-card system-topic-card xp-system-topic" type="button" data-topic-id="${XP_RULES_TOPIC_ID}">
        <span class="topic-category category-aviso">Guia oficial</span>
        <strong>XP, missões e progressão</strong><p>Veja como ganhar XP, os bônus de assinatura e quanto é necessário para cada patente.</p>
        <small>Questionário Bizu · tópico fixo</small>
    </button>`;
    const patentGuide = `<button class="topic-card system-topic-card" type="button" data-topic-id="${PATENT_GUIDE_TOPIC_ID}">
        <span class="topic-category category-aviso">Guia oficial</span>
        <strong>Patentes do Ranking</strong><p>Conheça todas as insígnias e o significado de cada patente.</p>
        <small>Questionário Bizu · tópico fixo</small>
    </button>`;
    const userTopics = items.map((topic) => `<button class="topic-card" type="button" data-topic-id="${topic.id}">
        <span class="topic-category category-${topic.categoria}">${categoryNames[topic.categoria] || 'Tópico'}</span>
        <strong>${safeText(topic.titulo)}</strong><p>${safeText(topic.conteudo)}</p>
        <small>${safeText(topic.usuarios?.nome || 'Usuário')} · ${safeText(formatTime(topic.atualizado_em, true))}${topic.fechado ? ' · Encerrado' : ''}</small>
    </button>`).join('');
    list.innerHTML = xpGuide + patentGuide + (userTopics || '<div class="chat-empty">Nenhum outro tópico ainda.</div>');
}

async function loadTopics() {
    const payload = await requestJson('topicos');
    renderTopics(payload.topicos || []);
}

async function openTopic(id) {
    if (String(id) === XP_RULES_TOPIC_ID) {
        activeTopicId = XP_RULES_TOPIC_ID;
        one('#topicList').classList.add('hidden');
        one('#topicForm').classList.add('hidden');
        const rows = PATENTS.map((patent) => `<tr>
            <td>${patentInsigniaMarkup(patent.min, { compact: true, decorative: true })}</td>
            <td><strong>${safeText(patent.name)}</strong></td>
            <td><strong>${patent.min.toLocaleString('pt-BR')} XP</strong></td>
        </tr>`).join('');
        one('#topicDetailContent').innerHTML = `<header class="topic-detail-head">
            <span class="topic-category category-aviso">Guia oficial</span>
            <h3>XP, missões e progressão</h3>
            <small>Questionário Bizu · tópico fixo</small>
        </header>
        <p class="topic-main-content">O XP mede sua evolução de estudo e define sua patente. A colocação do ranking continua sendo determinada pelos acertos; por isso, bônus e missões ajudam na patente sem alterar artificialmente o resultado competitivo.</p>
        <div class="xp-rules-grid">
            <article><strong>+10 XP</strong><span>Primeiro acerto em cada questão</span></article>
            <article><strong>+3 XP</strong><span>Revisão correta após pelo menos 24 horas</span></article>
            <article><strong>+4 XP</strong><span>Corrigir uma questão errada pela primeira vez</span></article>
            <article><strong>+20 XP</strong><span>Finalizar um simulado com 20 ou mais respostas</span></article>
            <article><strong>+30 / +60 XP</strong><span>Alcançar 80% / 90% em um simulado</span></article>
            <article><strong>+150 XP</strong><span>Dominar um capítulo: 30 questões e 80% de acertos</span></article>
        </div>
        <h4 class="xp-topic-subtitle">Missões diárias visíveis</h4>
        <div class="xp-rules-grid">
            <article><strong>25, 50, 75… XP</strong><span><b>Sequência certeira:</b> 10, 20, 30… acertos seguidos. A meta cresce em 10 e a recompensa em 25 XP por etapa; ambas reiniciam diariamente.</span></article>
            <article><strong>40 a 240 XP</strong><span><b>Ronda de disciplinas:</b> metas de 3, 6, 9, 12, 15 e 18. A recompensa progride para 40, 80, 120, 160, 200 e 240 XP; reinicia diariamente.</span></article>
            <article><strong>60, 120, 180… XP</strong><span><b>Ritmo diário:</b> responder 20, 40, 60… questões válidas. A recompensa vale o triplo da meta e ambas reiniciam diariamente.</span></article>
            <article><strong>+30 XP</strong><span><b>Precisão diária:</b> obter 80% de acertos em pelo menos 10 questões no dia.</span></article>
            <article><strong>+60 XP</strong><span><b>Excelência diária:</b> obter 90% de acertos em pelo menos 20 questões no dia.</span></article>
        </div>
        <h4 class="xp-topic-subtitle">Missões semanais visíveis</h4>
        <div class="xp-rules-grid">
            <article><strong>+200 XP</strong><span><b>Constância semanal:</b> estudar por 7 dias consecutivos.</span></article>
            <article><strong>+150 XP</strong><span><b>Centena da semana:</b> responder 100 questões válidas entre segunda e domingo.</span></article>
            <article><strong>+100 XP</strong><span><b>Explorador semanal:</b> estudar 5 capítulos diferentes na semana.</span></article>
        </div>
        <p class="topic-main-content">As missões podem ser realizadas em qualquer ordem. Questões puladas não contam. Cada etapa concede XP uma única vez; as diárias reiniciam no começo do novo dia e as metas semanais renovam na segunda-feira.</p>
        <h4 class="xp-topic-subtitle">Bônus único por plano</h4>
        <p class="topic-main-content">Premium concede <strong>500 XP</strong>, Plus concede <strong>1.200 XP</strong> e VIP concede <strong>2.500 XP</strong>. Em um upgrade, o usuário recebe somente a diferença; renovar o mesmo plano não repete o bônus.</p>
        <h4 class="xp-topic-subtitle">XP necessário para cada patente</h4>
        <div class="patent-guide-table-wrap"><table class="patent-guide-table xp-patent-table">
            <thead><tr><th>Insígnia</th><th>Patente</th><th>XP mínimo</th></tr></thead><tbody>${rows}</tbody>
        </table></div>`;
        one('#topicReplyForm').classList.add('hidden');
        one('#topicDetail').classList.remove('hidden');
        return;
    }
    if (String(id) === PATENT_GUIDE_TOPIC_ID) {
        activeTopicId = PATENT_GUIDE_TOPIC_ID;
        one('#topicList').classList.add('hidden');
        one('#topicForm').classList.add('hidden');
        const adminRow = `<tr class="patent-guide-special patent-guide-admin">
            <td>${patentInsigniaMarkup(0, { compact: true, decorative: true, admin: true })}</td>
            <td><strong>${ADMIN_PATENT.name}</strong><small>${ADMIN_PATENT.symbol}</small></td>
            <td>ADMs</td>
            <td>${ADMIN_PATENT.meaning}</td>
        </tr>`;
        const developerRow = `<tr class="patent-guide-special">
            <td>${patentInsigniaMarkup(0, { compact: true, decorative: true, developer: true })}</td>
            <td><strong>${DEVELOPER_PATENT.name}</strong><small>${DEVELOPER_PATENT.symbol}</small></td>
            <td>Exclusiva</td>
            <td>${DEVELOPER_PATENT.meaning}</td>
        </tr>`;
        const papiraoRow = `<tr class="patent-guide-papirao">
            <td><span class="patent-guide-crown"><img src="/assets/icons/coroa-papirao.svg" alt="" aria-hidden="true"></span></td>
            <td><strong>PAPIRÃO</strong><small>Coroa dourada do líder</small></td>
            <td>1º lugar</td>
            <td>Conquista especial e temporária de quem ocupa a primeira colocação no Top 3.</td>
        </tr>`;
        const rows = adminRow + developerRow + papiraoRow + PATENTS.map((patent, index) => {
            const next = PATENTS[index + 1];
            const range = next
                ? `${patent.min.toLocaleString('pt-BR')}–${(next.min - 1).toLocaleString('pt-BR')}`
                : `${patent.min.toLocaleString('pt-BR')}+`;
            return `<tr>
                <td>${patentInsigniaMarkup(patent.min, { compact: true, decorative: true })}</td>
                <td><strong>${safeText(patent.name)}</strong><small>${safeText(patent.symbol)}</small></td>
                <td>${range}</td>
                <td>${safeText(patent.meaning)}</td>
            </tr>`;
        }).join('');
        one('#topicDetailContent').innerHTML = `<header class="topic-detail-head">
            <span class="topic-category category-aviso">Guia oficial</span>
            <h3>Patentes do Ranking</h3>
            <small>Questionário Bizu · tópico fixo</small>
        </header>
        <p class="topic-main-content">As 52 patentes representam sua evolução pelo XP acumulado. Elas não alteram sua colocação, plano ou permissões. <strong>Oficial de Instrução</strong> e <strong>Comandante do Código</strong> são patentes institucionais. A coroa <strong>PAPIRÃO</strong> é uma conquista especial e temporária, exclusiva do primeiro colocado no Top 3.</p>
        <div class="patent-guide-table-wrap">
            <table class="patent-guide-table">
                <thead><tr><th>Insígnia</th><th>Patente e símbolo</th><th>XP</th><th>Significado</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
        one('#topicReplyForm').classList.add('hidden');
        one('#topicDetail').classList.remove('hidden');
        return;
    }
    const payload = await requestJson(`topicos?id=${encodeURIComponent(id)}`);
    const topic = payload.topico;
    if (!topic) return notify('Tópico não encontrado.');
    activeTopicId = String(topic.id);
    one('#topicList').classList.add('hidden');
    one('#topicForm').classList.add('hidden');
    const replies = (payload.respostas || []).map((reply) => `<article class="topic-answer"><strong>${safeText(reply.usuarios?.nome || 'Usuário')}</strong><p>${safeText(reply.conteudo).replace(/\n/g, '<br>')}</p><small>${safeText(formatTime(reply.criado_em, true))}</small></article>`).join('');
    one('#topicDetailContent').innerHTML = `<header class="topic-detail-head"><span class="topic-category category-${topic.categoria}">${categoryNames[topic.categoria]}</span><h3>${safeText(topic.titulo)}</h3><small>${safeText(topic.usuarios?.nome || 'Usuário')} · ${safeText(formatTime(topic.criado_em, true))}</small></header><p class="topic-main-content">${safeText(topic.conteudo).replace(/\n/g, '<br>')}</p><div class="topic-answers">${replies || '<div class="chat-empty">Ainda não há respostas.</div>'}</div>`;
    one('#topicReplyForm').classList.toggle('hidden', Boolean(topic.fechado));
    one('#topicDetail').classList.remove('hidden');
}

async function openTopics() {
    openModal('topicsModal');
    one('#topicNoticeOption').disabled = appState.user?.perfil !== 'supremo';
    one('#topicDetail').classList.add('hidden');
    one('#topicForm').classList.add('hidden');
    await loadTopics().catch((error) => notify(error.message));
}

export async function openXpRulesTopic() {
    await openTopics();
    await openTopic(XP_RULES_TOPIC_ID);
}

async function submitTopic(event) {
    event.preventDefault();
    try {
        const result = await requestJson('topicos', { method: 'POST', body: JSON.stringify({
            action: 'criar', titulo: one('#topicTitleInput').value, categoria: one('#topicCategory').value, conteudo: one('#topicContentInput').value,
        }) });
        event.currentTarget.reset();
        one('#topicForm').classList.add('hidden');
        await loadTopics();
        await openTopic(result.topico_id);
    } catch (error) { notify(error.message); }
}

async function submitTopicReply(event) {
    event.preventDefault();
    try {
        await requestJson('topicos', { method: 'POST', body: JSON.stringify({ action: 'responder', topico_id: activeTopicId, conteudo: one('#topicReplyInput').value }) });
        one('#topicReplyInput').value = '';
        await openTopic(activeTopicId);
    } catch (error) { notify(error.message); }
}

function bindCommunityUi() {
    bindEmojiPicker();
    one('#openChatBtn')?.addEventListener('click', () => openCommunityChat());
    one('#openSupportBtn')?.addEventListener('click', () => openCommunitySupport());
    one('#openTopicsBtn')?.addEventListener('click', openTopics);
    [['chatClose', 'chatModal'], ['supportClose', 'supportModal'], ['topicsClose', 'topicsModal']].forEach(([button, modal]) => one(`#${button}`)?.addEventListener('click', () => closeModal(modal)));
    ['chatModal', 'supportModal', 'topicsModal'].forEach((id) => one(`#${id}`)?.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeModal(id); }));
    one('#chatForm')?.addEventListener('submit', submitChat);
    one('#chatInput')?.addEventListener('input', (event) => { one('#chatCounter').textContent = `${countGraphemes(event.currentTarget.value)}/400`; });
    one('#chatInput')?.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); one('#chatForm').requestSubmit(); } });
    one('#chatRoomsToggle')?.addEventListener('click', () => one('#chatRoomPanel').classList.toggle('hidden'));
    one('#chatCreateRoomToggle')?.addEventListener('click', () => one('#chatRoomForm').classList.toggle('hidden'));
    one('#chatRoomType')?.addEventListener('change', (event) => one('#chatRoomParticipants').classList.toggle('hidden', event.target.value !== 'privada'));
    one('#chatRoomForm')?.addEventListener('submit', createRoom);
    one('#chatRoomList')?.addEventListener('click', async (event) => { const button = event.target.closest('[data-room-id]'); if (!button) return; currentRoomId = button.dataset.roomId; renderRooms(); one('#chatRoomPanel').classList.add('hidden'); await refreshChat({ quiet: false }); });
    one('#supportForm')?.addEventListener('submit', submitSupport);
    one('#supportConversations')?.addEventListener('click', async (event) => { const button = event.target.closest('[data-support-id]'); if (!button) return; supportConversationId = button.dataset.supportId; await loadSupport(); });
    one('#topicForm')?.addEventListener('submit', submitTopic);
    one('#topicReplyForm')?.addEventListener('submit', submitTopicReply);
    one('#newTopicBtn')?.addEventListener('click', () => { one('#topicDetail').classList.add('hidden'); one('#topicList').classList.add('hidden'); one('#topicForm').classList.remove('hidden'); one('#topicTitleInput').focus(); });
    one('#topicCancel')?.addEventListener('click', () => { one('#topicForm').classList.add('hidden'); one('#topicList').classList.remove('hidden'); });
    one('#topicBack')?.addEventListener('click', () => { one('#topicDetail').classList.add('hidden'); one('#topicList').classList.remove('hidden'); activeTopicId = null; });
    one('#topicList')?.addEventListener('click', (event) => { const button = event.target.closest('[data-topic-id]'); if (button) openTopic(button.dataset.topicId).catch((error) => notify(error.message)); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && activeModal) closeModal(activeModal); });
}

function bindActivityTracking() {
    const activity = () => document.visibilityState === 'visible' && sendActivityPing();
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((name) => window.addEventListener(name, activity, { passive: true }));
    document.addEventListener('visibilitychange', activity);
    window.addEventListener('pagehide', () => { try { fetch('/api/presenca', { method: 'DELETE', credentials: 'include', keepalive: true }); } catch { /* limpeza no servidor */ } });
}

export function startCommunity() {
    if (initialized) { sendActivityPing(); refreshPresence(); return; }
    initialized = true;
    bindCommunityUi();
    bindActivityTracking();
    sendActivityPing();
    refreshPresence();
    heartbeatTimer = setInterval(() => document.visibilityState === 'visible' && sendPresence(), HEARTBEAT_MS);
    presenceTimer = setInterval(refreshPresence, PRESENCE_REFRESH_MS);
    spotlightTimer = setInterval(rotateSpotlight, 8_000);
}
