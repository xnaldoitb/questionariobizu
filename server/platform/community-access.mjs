import { db } from './db.mjs';

export const GENERAL_ROOM_ID = '00000000-0000-4000-8000-000000000001';

export async function roomForUser(user, roomId) {
    const id = String(roomId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

    const { data: room, error } = await db()
        .from('chat_salas')
        .select('id,nome,tipo,criador_id,sistema,ativa,criado_em')
        .eq('id', id)
        .eq('ativa', true)
        .maybeSingle();
    if (error || !room) return null;
    if (room.tipo === 'publica') return room;

    const { data: membership, error: membershipError } = await db()
        .from('chat_sala_membros')
        .select('sala_id')
        .eq('sala_id', room.id)
        .eq('usuario_id', user.id)
        .maybeSingle();
    if (membershipError || !membership) return null;
    return room;
}

export function cleanText(value, maxLength) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/[\t ]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, maxLength + 1);
}

export function graphemeLength(value) {
    if (globalThis.Intl?.Segmenter) {
        return [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(value)].length;
    }
    return Array.from(value).length;
}
