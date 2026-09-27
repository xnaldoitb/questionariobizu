import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const view = await readFile('public/views/dashboard.html', 'utf8');
const profile = await readFile('public/app/domains/profile.js', 'utf8');
const profileRoute = await readFile('server/routes/perfil.mjs', 'utf8');
const community = await readFile('public/app/domains/community.js', 'utf8');
const rooms = await readFile('server/routes/chat-salas.mjs', 'utf8');
const chat = await readFile('server/routes/chat.mjs', 'utf8');
const migration = await readFile('supabase/migration-v4.55-perfil-chat.sql', 'utf8');
const router = await readFile('api/[...route].js', 'utf8');

assert(view.indexOf('id="openProfileBtn"') < view.indexOf('id="openChatBtn"'), 'Perfil deve ficar à esquerda do Chat.');
assert(!view.includes('id="onlineCount"') && !view.includes('id="onlineSpotlight"'));
assert(view.includes('id="chatHeaderOnline"') && view.includes('id="chatOnlineCount"'), 'A presença deve aparecer somente no chat e no botão de acesso ao chat.');
assert(view.includes('id="profileModal"') && view.includes('id="profileCurrentPassword"') && view.includes('id="profileNewPassword"'));
assert(profile.includes("requestJson('perfil'") && profile.includes('As novas senhas não coincidem.'));
assert(profileRoute.includes('bcrypt.compare') && profileRoute.includes('bcrypt.hash') && profileRoute.includes("requireUser(event)"));
assert(router.includes("['perfil'"));
assert(view.includes('id="chatUserPanel"') && view.includes('id="chatMentionList"'));
assert(community.includes("requestJson('chat-salas?usuarios=1')") && community.includes("acao: 'conversa-direta'"));
assert(community.includes('data-mention-user') && community.includes('insertMention'));
assert(rooms.includes('openDirectRoom') && rooms.includes('chave_direta'));
assert(chat.includes("tipo: 'chat_mencao'") && chat.includes('message.matchAll'));
assert(migration.includes('chat_salas_chave_direta_uidx'));

console.log('v4.55: perfil, PV, menções e presença exclusiva no chat verificados.');
