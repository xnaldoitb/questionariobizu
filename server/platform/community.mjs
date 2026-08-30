import { db } from './db.mjs';

const CONNECTED_WINDOW_MS = 2 * 60 * 1000;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const OFFLINE_AFTER_MS = 10 * 60 * 1000;
const MESSAGE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function isoBefore(ms) {
    return new Date(Date.now() - ms).toISOString();
}

export async function cleanupCommunity() {
    const client = db();

    // Remove navegadores que deixaram de enviar heartbeat.
    await client
        .from('presencas_online')
        .delete()
        .lt('visto_em', isoBefore(CONNECTED_WINDOW_MS));

    // Mesmo com a aba aberta, dez minutos sem atividade retiram o usuário da presença.
    await client
        .from('presencas_online')
        .delete()
        .lt('atividade_em', isoBefore(OFFLINE_AFTER_MS));

    // Limite de segurança: nenhuma mensagem do chat efêmero sobrevive por horas.
    await client
        .from('chat_temporario')
        .delete()
        .lt('criado_em', isoBefore(MESSAGE_MAX_AGE_MS));

    const activeCutoff = isoBefore(ACTIVE_WINDOW_MS);
    const connectedCutoff = isoBefore(CONNECTED_WINDOW_MS);

    const { count, error } = await client
        .from('presencas_online')
        .select('usuario_id', { count: 'exact', head: true })
        .gte('visto_em', connectedCutoff)
        .gte('atividade_em', activeCutoff);

    if (error) throw error;

    // Regra da sala temporária: sem nenhum usuário ativo, apaga toda a conversa.
    if (!Number(count || 0)) {
        const future = new Date(Date.now() + 60_000).toISOString();
        await client
            .from('chat_temporario')
            .delete()
            .lt('criado_em', future);
    }

    return Number(count || 0);
}

export async function touchPresence(userId, { activity = false } = {}) {
    const client = db();
    const now = new Date().toISOString();

    if (activity) {
        const { error } = await client
            .from('presencas_online')
            .upsert({
                usuario_id: userId,
                visto_em: now,
                atividade_em: now,
            }, { onConflict: 'usuario_id' });

        if (error) throw error;
        return;
    }

    // Heartbeat não renova a atividade. Assim, ficar com a aba aberta sem interagir
    // não mantém a pessoa artificialmente como "online" para sempre.
    const { error } = await client
        .from('presencas_online')
        .update({ visto_em: now })
        .eq('usuario_id', userId);

    if (error) throw error;
}

export async function removePresence(userId) {
    const { error } = await db()
        .from('presencas_online')
        .delete()
        .eq('usuario_id', userId);

    if (error) throw error;
}

export async function listActiveUsers(limit = 30) {
    const activeCutoff = isoBefore(ACTIVE_WINDOW_MS);
    const connectedCutoff = isoBefore(CONNECTED_WINDOW_MS);

    const { data, count, error } = await db()
        .from('presencas_online')
        .select('usuario_id,atividade_em,usuarios(id,nome,usuario,perfil,vip,premium)', { count: 'exact' })
        .gte('visto_em', connectedCutoff)
        .gte('atividade_em', activeCutoff)
        .order('atividade_em', { ascending: false })
        .limit(Math.max(1, Math.min(Number(limit) || 30, 50)));

    if (error) throw error;

    return {
        count: Number(count || 0),
        users: (data || [])
            .map((row) => ({
                id: row.usuarios?.id || row.usuario_id,
                nome: row.usuarios?.nome || 'Usuário',
                usuario: row.usuarios?.usuario || '',
                perfil: row.usuarios?.perfil || 'aluno',
                vip: Boolean(row.usuarios?.vip),
                premium: Boolean(row.usuarios?.premium),
            })),
    };
}
