import { db } from './db.mjs';

function normalized(record) {
    return {
        usuario_id: record.usuario_id,
        tipo: record.tipo || 'sistema',
        titulo: String(record.titulo || '').trim().slice(0, 80),
        mensagem: String(record.mensagem || '').trim().slice(0, 240),
        acao: record.acao || null,
        referencia_id: record.referencia_id ? String(record.referencia_id) : null,
        chave: String(record.chave || '').trim().slice(0, 160),
    };
}

export async function createNotifications(records = []) {
    const rows = records.map(normalized).filter((row) => row.usuario_id && row.titulo && row.mensagem && row.chave);
    if (!rows.length) return;
    const { error } = await db().from('notificacoes').upsert(rows, {
        onConflict: 'usuario_id,chave',
        ignoreDuplicates: true,
    });
    if (error) throw error;
}

export async function createNotification(record) {
    return createNotifications([record]);
}

export async function ensureAccessNotification(user) {
    if (user.perfil !== 'aluno' || user.vip || !user.validade_ate) return;
    const end = new Date(user.validade_ate);
    const remainingMs = end.getTime() - Date.now();
    if (!Number.isFinite(remainingMs)) return;
    const days = Math.ceil(remainingMs / 86_400_000);
    if (days > 7) return;

    const dateKey = end.toISOString().slice(0, 10);
    if (days <= 0) {
        await createNotification({
            usuario_id: user.id,
            tipo: 'vencimento',
            titulo: 'Seu acesso venceu',
            mensagem: 'Renove seu plano para voltar a responder às questões.',
            acao: 'pagamentos',
            chave: `acesso-vencido:${dateKey}`,
        });
        return;
    }

    const milestone = days <= 1 ? 1 : days <= 3 ? 3 : 7;
    await createNotification({
        usuario_id: user.id,
        tipo: 'vencimento',
        titulo: 'Vencimento próximo',
        mensagem: `Seu acesso termina em ${days} ${days === 1 ? 'dia' : 'dias'}. Você já pode renovar sem perder o período atual.`,
        acao: 'pagamentos',
        chave: `acesso-vencimento:${dateKey}:${milestone}`,
    });
}
