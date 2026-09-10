import { db } from './db.mjs';

export function canManageAdminTarget(actor, target) {
    if (actor?.perfil === 'supremo') return true;
    return target?.perfil === 'aluno' && (
        target.responsavel_admin_id === actor?.id
        || (!target.responsavel_admin_id && !target.vip)
    );
}

export async function claimUnassignedAdminTarget(actor, target) {
    if (actor?.perfil === 'supremo') return true;
    if (target?.responsavel_admin_id) return target.responsavel_admin_id === actor?.id;

    const { data, error } = await db()
        .from('usuarios')
        .update({ responsavel_admin_id: actor.id })
        .eq('id', target.id)
        .is('responsavel_admin_id', null)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    if (data) target.responsavel_admin_id = actor.id;
    return Boolean(data);
}
