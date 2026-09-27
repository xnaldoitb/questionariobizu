import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [view, styles, progression, community, notifications] = await Promise.all([
    readFile(new URL('../public/views/dashboard.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/styles/12-community-hub.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/app/domains/progression.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/app/domains/community.js', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/notificacoes.mjs', import.meta.url), 'utf8'),
]);

for (const id of ['chatOnlineCount', 'chatUnreadCount', 'supportUnreadCount']) assert(view.includes(`id="${id}"`));
assert(styles.includes('.community-unread-count.hidden'));
assert(styles.includes('.community-online-count::before'));
assert(progression.includes("updateCount('chatUnreadCount', counters.chat)"));
assert(progression.includes("updateCount('supportUnreadCount', counters.suporte)"));
assert(progression.includes("acao: 'marcar_contexto'"));
assert(community.includes("acknowledgeCommunityContent('chat', currentRoomId)"));
assert(community.includes("acknowledgeCommunityContent('suporte', supportConversationId)"));
assert(community.includes("one('#chatOnlineCount')"));
assert(notifications.includes("['chat_privado', 'chat_mencao']"));
assert(notifications.includes("body.acao === 'marcar_contexto'"));

console.log('v4.55.2: marcadores de online, Chat e Suporte validados.');
