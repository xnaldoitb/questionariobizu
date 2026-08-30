import { db } from './db.mjs';

const BRAZIL_OFFSET = '-03:00';

export function normalizeValidityDate(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;

    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T23:59:59.999${BRAZIL_OFFSET}`)
        : new Date(raw);

    if (Number.isNaN(date.getTime())) {
        throw new Error('Data de validade inválida.');
    }

    return date.toISOString();
}

export function isAccessExpired(validity) {
    if (!validity) return false;
    const time = new Date(validity).getTime();
    return Number.isFinite(time) && time <= Date.now();
}

// Desde a v4.7, expiração bloqueia somente o banco de questões. A conta
// permanece acessível para perfil, histórico, ranking e contato dos ADMs.
export async function expireUserAccess(userId) {
    if (!userId) return;

    await db()
        .from('usuarios')
        .update({ desativado_por_validade: true, premium: false })
        .eq('id', userId)
        .neq('perfil', 'supremo')
        .eq('vip', false);
}

export async function expireOverdueAccounts() {
    const now = new Date().toISOString();

    const { error } = await db()
        .from('usuarios')
        .update({ desativado_por_validade: true, premium: false })
        .neq('perfil', 'supremo')
        .eq('vip', false)
        .eq('acesso_teste', false)
        .not('validade_ate', 'is', null)
        .lt('validade_ate', now);

    if (error) throw error;
}
