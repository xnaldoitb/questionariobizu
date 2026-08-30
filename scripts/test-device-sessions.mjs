import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, login, auth, logout, maintenance, view, users] = await Promise.all([
    read('supabase/migration-v4.25-dois-dispositivos-filtro-adm.sql'),
    read('server/routes/login.mjs'),
    read('server/platform/auth.mjs'),
    read('server/routes/logout.mjs'),
    read('server/routes/admin-maintenance.mjs'),
    read('public/views/admin.html'),
    read('public/app/domains/admin/users.js'),
]);

for (const marker of [
    'create table if not exists public.sessoes_dispositivo',
    'unique (usuario_id, device_hash)',
    'for update',
    'v_quantidade >= p_limite',
    'p_limite integer default 2',
    'grant execute on function public.iniciar_sessao_dispositivo_aluno',
]) assert.ok(migration.toLowerCase().includes(marker), `Migration sem: ${marker}`);

assert.ok(login.includes("'iniciar_sessao_dispositivo_aluno'"));
assert.ok(login.includes('p_limite: 2'));
assert.ok(login.includes("codigo: 'LIMITE_DISPOSITIVOS'"));
assert.ok(auth.includes("from('sessoes_dispositivo')"));
assert.ok(auth.includes(".eq('usuario_id', registro.id)"));
assert.ok(logout.includes("from('sessoes_dispositivo').delete()"));
assert.ok(maintenance.includes("from('sessoes_dispositivo')"));

assert.ok(view.includes('id="userResponsibleFilter"'));
assert.ok(!view.includes('id="userMineOnly"'));
assert.ok(users.includes("responsibility === 'sem_responsavel'"));
assert.ok(users.includes('user.responsavel_admin_id === responsibility'));

console.log('Dispositivos: limite 2 atômico, logout isolado e filtro por ADM validados estruturalmente.');
