import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [route, frontend, migration, css] = await Promise.all([
    readFile(new URL('../server/routes/suporte.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../public/app/domains/community.js', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migration-v4.48.1-suporte-otimizado.sql', import.meta.url), 'utf8'),
    readFile(new URL('../public/styles/12-community-hub.css', import.meta.url), 'utf8'),
]);

assert(route.includes('return create ? ensureOwnConversation(user) : findOwnConversation(user)'));
assert(route.includes("conversationFor(user, body.conversa_id, { create: true })"));
assert(!route.includes("if (user.perfil !== 'supremo') return ownConversation(user)"));
assert(route.includes("rpc('listar_suporte_conversas_v4481'"));
assert(route.includes('mensagens: conversation ? await messages(conversation.id, user.id) : []'));
assert(frontend.includes('SUPPORT_DIRECTORY_REFRESH_MS = 48_000'));
assert(frontend.includes('supportRequestSequence'));
assert(frontend.includes('refreshDirectory: false'));
assert(frontend.includes('aria-pressed'));
assert(css.includes('.support-conversation-preview'));
assert(migration.includes('join lateral'));
assert(migration.includes('suporte_mensagens_conversa_recente_idx'));
assert(!migration.includes('delete from public.suporte_conversas'));

console.log('Suporte v4.48.1: criação sob demanda, lista sem vazios e seleção otimizada validadas.');
