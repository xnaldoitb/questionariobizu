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

export async function expireUserAccess(userId) {
    if (!userId) return;

    await db()
        .from('usuarios')
        .update({
            ativo: false,
            desativado_por_validade: true,
            sessao_ativa_id: null,
            sessao_ativa_expira_em: null,
        })
        .eq('id', userId)
        .neq('perfil', 'supremo')
        .eq('vip', false);
}

export async function expireOverdueAccounts() {
    const now = new Date().toISOString();

    const { error } = await db()
        .from('usuarios')
        .update({
            ativo: false,
            desativado_por_validade: true,
            sessao_ativa_id: null,
            sessao_ativa_expira_em: null,
        })
        .neq('perfil', 'supremo')
        .eq('vip', false)
        .eq('ativo', true)
        .not('validade_ate', 'is', null)
        .lt('validade_ate', now);

    if (error) throw error;
}
