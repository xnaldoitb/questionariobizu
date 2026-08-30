import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScheduledPaymentHandler } from '../server/platform/scheduled-payments.mjs';
import { reconcileRecords } from '../server/platform/payment-reconciliation.mjs';

const key = 'a'.repeat(64);
let claims = 0;
const dependencies = {
    secret: () => key,
    rateLimit: async () => true,
    claim: async () => { claims++; return [{ id: 'old-unapplied' }]; },
    reconcile: rows => reconcileRecords(rows, async () => ({ status: 'approved', aplicado_em: '2026-08-28' })),
    log: () => {},
};
const handle = createScheduledPaymentHandler(dependencies);
const event = { httpMethod: 'GET', headers: { authorization: `Bearer ${key}` } };
assert.equal((await handle({ ...event, httpMethod: 'POST' })).statusCode, 405);
assert.equal((await handle({ httpMethod: 'GET', headers: {} })).statusCode, 401);
assert.equal((await handle({ ...event, headers: { authorization: `Bearer ${'b'.repeat(64)}` } })).statusCode, 401);
assert.equal(claims, 0);
assert.equal((await createScheduledPaymentHandler({ ...dependencies, secret: () => '' })(event)).statusCode, 503);
assert.equal((await createScheduledPaymentHandler({ ...dependencies, rateLimit: async () => false })(event)).statusCode, 429);
assert.equal(claims, 0);
// No login, cookie or user session is supplied.
const result = await handle(event);
assert.equal(result.statusCode, 200);
assert.equal(JSON.parse(result.body).confirmados, 1);
assert.equal(claims, 1);
assert(!result.body.includes(key));
const failing = createScheduledPaymentHandler({ ...dependencies, reconcile: rows => reconcileRecords(rows, async () => { throw new Error('timeout'); }) });
assert.equal((await failing(event)).statusCode, 503);
assert.equal((await createScheduledPaymentHandler({ ...dependencies, claim: async () => [] })(event)).statusCode, 200);
const sql = await readFile(new URL('../supabase/migration-v4.23-reconciliacao-agendada.sql', import.meta.url), 'utf8');
for (const marker of ['aplicado_em IS NULL', 'LIMIT 10 FOR UPDATE SKIP LOCKED', 'ultima_consulta_em ASC NULLS FIRST', 'REVOKE ALL']) assert(sql.includes(marker));
assert(!sql.includes('aplicar_periodo_acesso'));
const scheduling = await readFile(new URL('../supabase/ativar-cron-pagamentos.sql', import.meta.url), 'utf8');
assert(scheduling.includes('*/5 * * * *'));
assert(scheduling.includes('vault.decrypted_secrets'));
console.log('Agendamento: autenticação, limites, execução sem login, falhas e fila validados com dependências simuladas. SQL não executado.');
