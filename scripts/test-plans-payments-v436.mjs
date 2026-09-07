import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { accountBadges } from '../public/app/foundation/badges.js';
import { paymentPlanTier } from '../public/app/domains/access.js';

assert.match(accountBadges({ perfil: 'aluno', premium: true, plano_atual: 'mensal' }), /PREMIUM/);
assert.doesNotMatch(accountBadges({ perfil: 'aluno', premium: true, plano_atual: 'mensal' }), /PLUS/);
assert.match(accountBadges({ perfil: 'aluno', premium: true, plano_atual: 'trimestral' }), /PLUS/);
assert.match(accountBadges({ perfil: 'aluno', premium: true, vip: true, plano_atual: 'trimestral' }), /VIP/);
assert.equal(paymentPlanTier({ id: 'mensal' }).label, 'PREMIUM');
assert.equal(paymentPlanTier({ id: 'trimestral' }).label, 'PLUS');
assert.equal(paymentPlanTier({ id: 'vitalicio', acesso_permanente: true }).label, 'VIP');

const [migration, access, platform, route, adminUi, css] = await Promise.all([
    readFile('supabase/migration-v4.36-plus-pagamentos.sql', 'utf8'),
    readFile('public/app/domains/access.js', 'utf8'),
    readFile('server/platform/payments.mjs', 'utf8'),
    readFile('server/routes/admin-payments.mjs', 'utf8'),
    readFile('public/app/domains/admin/payments.js', 'utf8'),
    readFile('public/styles/09-trial-access.css', 'utf8'),
]);

for (const marker of ['plano_atual', "set plano_atual = 'vitalicio'", 'excluido_em', 'excluido_por_admin_id']) {
    assert(migration.includes(marker), `Migração v4.36 sem ${marker}`);
}
assert(access.includes('paymentEntryShownForUser') && access.includes('openPaymentPlans();'));
for (const marker of ['REMOVABLE_PAYMENT_STATUSES', 'paymentCanBeRemoved', 'expireCheckoutPreference', "method: 'PUT'"]) {
    assert(platform.includes(marker), `Proteção de exclusão sem ${marker}`);
}
for (const marker of ['delete_payment', 'reconcilePayment(original)', 'expireCheckoutPreference(checked)', 'pagamento_excluido']) {
    assert(route.includes(marker), `Rota administrativa sem ${marker}`);
}
assert(adminUi.includes('data-payment-action="delete"'));
assert(!platform.match(/REMOVABLE_PAYMENT_STATUSES[\s\S]{0,220}refunded/));
assert(css.includes('width: min(640px, calc(100vw - 36px))'));
assert(css.includes('.payment-plan-tier.tier-plus'));

console.log('Planos v4.36: abertura automática, Plus, modal compacto e exclusão protegida passaram.');
