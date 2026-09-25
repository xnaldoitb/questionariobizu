import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adminView = await readFile('public/views/admin.html', 'utf8');
const adminClient = await readFile('public/app/domains/admin/hymns.js', 'utf8');
const management = await readFile('public/app/domains/management.js', 'utf8');
const publicClient = await readFile('public/app/domains/hymns.js', 'utf8');
const adminRoute = await readFile('server/routes/admin-hinos.mjs', 'utf8');
const publicRoute = await readFile('server/routes/hinos.mjs', 'utf8');
const router = await readFile('api/[...route].js', 'utf8');
const migration = await readFile('supabase/migration-v4.53-hinos-administraveis.sql', 'utf8');

assert(adminView.includes('data-admin="hymnsPanel"') && adminView.includes('id="adminHymnForm"'));
assert(adminView.includes('id="adminHymnAudioFile"') && adminView.includes('id="adminHymnImportDefaults"'));
assert(management.includes("'hymnsPanel'") && management.includes('bindHymnManagement'));
assert(adminClient.includes("method: 'DELETE'") && adminClient.includes("method: 'PUT'") && adminClient.includes("method: 'POST'"));
assert(adminClient.includes('preparar-audio') && adminClient.includes('importar-padrao'));
assert(adminRoute.includes("requireUser(event, 'supremo')") && adminRoute.includes('createSignedUploadUrl'));
assert(publicRoute.includes(".eq('ativo', true)"));
assert(publicClient.includes("fetch('/api/hinos'") && publicClient.includes("fetch('/assets/hinos/hinos.json'"));
assert(router.includes("['hinos'") && router.includes("['admin-hinos'"));
assert(migration.includes('create table if not exists public.hinos') && migration.includes("'hinos-audio'"));

console.log('Hinos v4.53: CRUD administrativo, importação e áudio verificados.');
