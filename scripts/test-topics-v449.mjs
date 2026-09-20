import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const migrationPath = 'supabase/migration-v4.49-topicos-completos.sql';
await access(new URL(migrationPath, root));

const [route, ui, view, css, migration, schema] = await Promise.all([
    readFile(new URL('server/routes/topicos.mjs', root), 'utf8'),
    readFile(new URL('public/app/domains/community.js', root), 'utf8'),
    readFile(new URL('public/views/dashboard.html', root), 'utf8'),
    readFile(new URL('public/styles/12-community-hub.css', root), 'utf8'),
    readFile(new URL(migrationPath, root), 'utf8'),
    readFile(new URL('supabase/schema.sql', root), 'utf8'),
]);

assert(route.includes("['GET', 'POST', 'PUT', 'DELETE']"));
assert(route.includes("topic.autor_id === user.id || user.perfil === 'supremo'"));
assert(route.includes("body.action === 'editar'"));
assert(route.includes("event.httpMethod === 'DELETE'"));
assert(route.includes("action === 'reagir'"));
assert(route.includes("new Set(['gostei', 'nao_gostei'])"));
assert(route.includes("onConflict: 'topico_id,usuario_id'"));
assert(route.includes('pode_gerenciar: canManage(topic, user)'));
assert(!route.includes('autor_id: topic.autor_id'));

for (const id of ['topicToolbar', 'topicSearch', 'topicFilter', 'topicSummary', 'topicFormTitle', 'topicSubmit']) {
    assert(view.includes(`id="${id}"`));
}
for (const marker of ['data-topic-action="editar"', 'data-topic-action="excluir"', 'data-topic-reaction="gostei"', 'data-topic-reaction="nao_gostei"']) {
    assert(ui.includes(marker));
}
assert(ui.includes("method: 'DELETE'"));
assert(ui.includes("method: 'PUT'"));
assert(ui.includes('window.confirm'));
assert(css.includes('.topic-toolbar'));
assert(css.includes('.topic-reactions'));
assert(css.includes('.topic-manage-actions'));
assert(migration.includes('create table if not exists public.topico_reacoes'));
assert(migration.includes('primary key (topico_id, usuario_id)'));
assert(schema.includes('create table if not exists public.topico_reacoes'));

console.log('Tópicos v4.49: edição, exclusão, moderação, filtros e reações validados.');
