import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findProviderPayment, reconcileRecords } from '../server/platform/payment-reconciliation.mjs';

const record = { id: 'original', mp_payment_id_informado: '175758134412' };
const approved = { id: 175758134412, external_reference: record.id, status: 'approved' };
assert.deepEqual(await findProviderPayment(record, async path => {
    assert.equal(path, '/v1/payments/175758134412');
    return approved;
}), approved);
await assert.rejects(findProviderPayment(record, async () => ({ ...approved, external_reference: 'other' })), /não corresponde/);
await assert.rejects(findProviderPayment(record, async () => ({ ...approved, id: 123 })), /não corresponde/);
const pending = { id: 11, external_reference: 'original', status: 'pending' };
assert.equal((await findProviderPayment({ id: 'original' }, async () => ({ results: [pending, approved] }))).status, 'approved');
let pages = 0;
const paginated = await findProviderPayment({ id: 'original' }, async path => {
    const offset = new URL(path, 'https://example.test').searchParams.get('offset');
    pages++;
    return offset === '0' ? { results: Array(50).fill(pending), paging: { total: 51 } } : { results: [approved], paging: { total: 51 } };
});
assert.equal(pages, 2);
assert.equal(paginated.status, 'approved');
assert.equal(await findProviderPayment({ id: 'original' }, async () => ({ results: [{ ...approved, external_reference: 'other' }] })), null);
assert.deepEqual(await reconcileRecords([{ id: 1 }, { id: 2 }], async r => {
    if (r.id === 1) throw new Error('provider unavailable');
    return { status: 'approved', aplicado_em: '2026-08-28' };
}), { confirmados: 1, falhas: 1, verificados: 2 });

// Structural guards complement unit tests; these do not execute PostgreSQL.
const sql = await readFile(new URL('../supabase/migration-v4.20-reconciliacao-compensacao.sql', import.meta.url), 'utf8');
assert.match(sql, /IF v_pagamento.aplicado_em IS NOT NULL THEN/);
assert.match(sql, /IF v_pagamento.compensacao_manual_id IS NOT NULL THEN/);
assert.match(sql, /ELSE\s+--[^\n]+\n\s+v_validade := public.aplicar_periodo_acesso/);
const frontend = await readFile(new URL('../public/app/domains/access.js', import.meta.url), 'utf8');
assert.doesNotMatch(frontend, /data\.acesso_questoes/);
assert.match(frontend, /export function openPaymentPlans\(\)[\s\S]*?startPaymentPolling\(\)/);
console.log('Reconciliação: testes unitários e verificações estruturais passaram.');
