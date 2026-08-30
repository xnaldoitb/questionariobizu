import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveQuestionAccess } from '../server/platform/access-policy.mjs';

const now = Date.parse('2026-08-28T12:00:00Z');
const user = { perfil: 'aluno', vip: false, validade_ate: null, teste_saldo_segundos: 1800, teste_ciclo_em: null };
assert.equal(resolveQuestionAccess(null, now).permitido, false);
assert.equal(resolveQuestionAccess(user, now).codigo, 'TESTE_PAUSADO');
assert.equal(resolveQuestionAccess(user, now).permitido, false); // login/activity required
const active = { ...user, teste_ciclo_em: new Date(now).toISOString(), teste_saldo_segundos: 1780, teste_ativo_ate: new Date(now + 20000).toISOString() };
assert.equal(resolveQuestionAccess(active, now).restante_ms, 1800000);
assert.equal(resolveQuestionAccess(active, now + 10000).restante_ms, 1790000);
assert.equal(resolveQuestionAccess(active, now + 20000).permitido, false); // heartbeat cannot be bypassed
const exhausted = { ...user, teste_ciclo_em: new Date(now).toISOString(), teste_saldo_segundos: 0 };
assert.equal(resolveQuestionAccess(exhausted, now).codigo, 'TESTE_EXPIRADO');
assert.equal(resolveQuestionAccess(exhausted, now + 8 * 3600000 - 1).permitido, false);
assert.equal(resolveQuestionAccess(exhausted, now + 8 * 3600000).codigo, 'TESTE_PAUSADO');
assert.equal(resolveQuestionAccess(exhausted, now + 8 * 3600000).restante_ms, 1800000);
assert.equal(resolveQuestionAccess({ ...exhausted, validade_ate: new Date(now - 1).toISOString() }, now).codigo, 'ACESSO_VENCIDO');
assert.equal(resolveQuestionAccess({ ...active, validade_ate: new Date(now + 86400000).toISOString() }, now).codigo, 'ACESSO_ATIVO');
assert.equal(resolveQuestionAccess({ ...exhausted, vip: true }, now).codigo, 'ACESSO_VITALICIO');
assert.equal(resolveQuestionAccess({ ...exhausted, perfil: 'supremo' }, now).permitido, true);

const sql = await readFile(new URL('../supabase/migration-v4.21-acesso-ativo-recorrente.sql', import.meta.url), 'utf8');
assert.match(sql, /FOR UPDATE/);
assert.match(sql, /interval '8 hours'/);
assert.match(sql, /teste_saldo_segundos=u.teste_saldo_segundos-reserva/);
assert.match(sql, /teste_saldo_segundos\+restante_reserva/);
assert.match(sql, /REVOKE ALL ON FUNCTION public.atualizar_teste_ativo/);
assert.doesNotMatch(sql, /UPDATE public.pagamentos|DELETE FROM|TRUNCATE/i);
const access = await readFile(new URL('../public/app/domains/access.js', import.meta.url), 'utf8');
assert.match(access, /export function startAccessIndicator\(\)[\s\S]*?startPaymentPolling\(\)/);
const close = access.match(/function closePaymentPlans\(\) \{([^}]+)\}/)[1];
assert.doesNotMatch(close, /clearInterval/);
assert.doesNotMatch(access, /paymentModal'\)\?\.classList\.contains\('hidden'\)\) return/);
console.log('Acesso: 13 cenários de política e verificações estruturais passaram (SQL não executado).');
