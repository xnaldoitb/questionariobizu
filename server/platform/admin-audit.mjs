import { db } from './db.mjs';

const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastCleanupAt = 0;

export async function auditAdmin(actor, action, targetType, targetId = null, details = {}) {
    const forbidden = /senha|password|token|secret|hash|whatsapp/i;
    const safeDetails = Object.fromEntries(
        Object.entries(details).filter(([key, value]) =>
            !forbidden.test(key)
            && (['string', 'number', 'boolean'].includes(typeof value) || value === null)
        )
    );
    const { error } = await db().from('auditoria_admin').insert({
        ator_id: actor.id,
        acao: String(action).slice(0, 80),
        alvo_tipo: targetType,
        alvo_id: targetId == null ? null : String(targetId).slice(0, 120),
        detalhes: safeDetails,
    });
    if (error) {
        console.error('Falha ao registrar auditoria administrativa:', error.message);
        return false;
    }

    // Limpeza oportunista: mantém apenas o mínimo necessário e dispensa outro cron.
    if (Date.now() - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
        lastCleanupAt = Date.now();
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
        const cleanup = await db().from('auditoria_admin').delete().lt('criado_em', cutoff);
        if (cleanup.error) console.error('Falha ao limpar auditoria antiga:', cleanup.error.message);
    }
    return true;
}
