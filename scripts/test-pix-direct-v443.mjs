import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [platform, access, view, css, admin] = await Promise.all([
    readFile('server/platform/payments.mjs', 'utf8'),
    readFile('public/app/domains/access.js', 'utf8'),
    readFile('public/views/payment.html', 'utf8'),
    readFile('public/styles/09-trial-access.css', 'utf8'),
    readFile('public/app/domains/admin/payments.js', 'utf8'),
]);

for (const marker of [
    "mercadoPagoRequest('/v1/payments'",
    "payment_method_id: 'pix'",
    "headers: { 'x-idempotency-key': paymentId }",
    'qr_code_base64',
    'point_of_interaction',
    'date_of_expiration',
    'mercado_pago_payment_id: String(payment.id)',
]) assert(platform.includes(marker), `Pagamento Pix direto sem ${marker}`);

assert(!platform.includes("mercadoPagoRequest('/checkout/preferences'"));
assert(platform.includes("body: JSON.stringify({ status: 'cancelled' })"));
for (const id of ['paymentPixPanel', 'paymentPixQr', 'paymentPixCode', 'paymentPixCopy', 'paymentPixBack']) {
    assert(view.includes(`id="${id}"`), `Janela Pix sem #${id}`);
}
for (const marker of ['showPixPayment(data)', 'copyPixCode', 'data:image/png;base64,', 'startPaymentPolling()']) {
    assert(access.includes(marker), `Interface Pix direta sem ${marker}`);
}
assert(!access.includes("window.open('', '_blank')"));
assert(css.includes('.payment-pix-qr-frame') && css.includes('.payment-pix-code'));
assert(admin.includes('result.qr_code'));

console.log('Pix v4.43: QR Code interno, copia e cola, confirmação automática e cancelamento validados.');
