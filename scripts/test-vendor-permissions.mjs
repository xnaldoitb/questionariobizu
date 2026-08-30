import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [usersRoute, paymentsRoute, usersUi] = await Promise.all([
    readFile(new URL('../server/routes/admin-users.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/admin-payments.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../public/app/domains/admin/users.js', import.meta.url), 'utf8'),
]);
const [adminView, managementUi, paymentsUi] = await Promise.all([
    readFile(new URL('../public/views/admin.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/app/domains/management.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/app/domains/admin/payments.js', import.meta.url), 'utf8'),
]);

assert.ok(usersRoute.includes('responsavel_admin_id.is.null,perfil.eq.aluno,vip.eq.false'));
assert.ok(usersRoute.includes('claimUnassignedTarget(actor, target)'));
assert.ok(usersRoute.includes("'approve'"));
assert.ok(usersRoute.includes("'set_validity'"));
assert.ok(paymentsRoute.includes("action === 'manual_grant'"));
assert.ok(paymentsRoute.includes('claimUnassignedTarget(actor, target)'));
assert.ok(paymentsRoute.includes("target.responsavel_admin_id === actor.id"));
assert.ok(usersUi.includes("data-user-command=\"approve\""));
assert.ok(usersUi.includes("data-user-command=\"validity\""));
assert.ok(adminView.includes('id="permanentValidityBtn"'));
assert.ok(!adminView.includes('id="paymentMineOnly"'));
assert.ok(!adminView.includes('id="paymentHistoryMineOnly"'));
assert.ok(!adminView.includes('ADMINISTRAÇÃO 2.0'));
assert.ok(managementUi.includes('usuários sob sua responsabilidade'));
assert.ok(managementUi.includes('ainda sem responsável definido'));
assert.ok(!paymentsUi.includes("one('#paymentMineOnly')"));
assert.ok(!usersRoute.includes('Usuários VIP só podem ser apagados pelo Desenvolvedor'));
assert.ok(!usersRoute.includes('Somente o Desenvolvedor pode alterar o status VIP'));
assert.ok(usersRoute.includes('const requestedVip = asBoolean(body.vip)'));
assert.ok(usersUi.includes('Apagar esta conta VIP e todo o histórico'));
assert.ok(managementUi.includes('conceder ou remover VIP e excluir seus usuários'));

console.log('Vendedores: controle integral de VIP próprio, exclusão e isolamento por responsabilidade validados.');
