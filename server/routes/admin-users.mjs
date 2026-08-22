import bcrypt from 'bcryptjs';
import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import {
    expireOverdueAccounts,
    isAccessExpired,
    normalizeValidityDate,
} from '../platform/access-validity.mjs';

const MANAGEMENT_ROLES = ['admin', 'supremo'];
const COMMON_ADMIN_ACTIONS = new Set([
    'approve',
    'deny',
    'set_validity',
    'toggle_active',
    'update_user',
]);

const V43_COLUMNS = [
    'criado_por_admin_id',
    'aprovado_por_admin_id',
    'responsavel_admin_id',
    'vip',
    'vip_desde',
];

function migrationMissing(error) {
    const message = String(error?.message || '').toLowerCase();
    const missingKnownColumn = [
        'validade_ate',
        'desativado_por_validade',
        ...V43_COLUMNS,
    ].some((column) => message.includes(column));

    return missingKnownColumn && (
        message.includes('does not exist') ||
        message.includes('schema cache') ||
        message.includes('column')
    );
}

function migrationResponse() {
    return json(503, {
        erro: 'Esta versão requer a migration v4.3. Execute supabase/migration-v4.3-vip-auditoria-ranking.sql no Supabase antes de publicar.',
        codigo: 'MIGRATION_V43_REQUIRED',
    });
}

async function findTarget(id) {
    const { data, error } = await db()
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    return { target: data, error };
}

function isProtectedFromCommonAdmin(target) {
    return Boolean(target?.vip) || target?.perfil === 'admin' || target?.perfil === 'supremo';
}

function canManageTarget(actor, target) {
    if (actor.perfil === 'supremo') return true;
    return target?.perfil === 'aluno' && !target?.vip;
}

function clearSessionFields(payload) {
    return {
        ...payload,
        sessao_ativa_id: null,
        sessao_ativa_expira_em: null,
    };
}

function normalizedRole(body) {
    return body.perfil === 'admin' ? 'admin' : 'aluno';
}

function asBoolean(value) {
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['1', 'true', 'sim', 'yes', 'on'].includes(normalized);
}

async function validateResponsibleAdmin(id) {
    const value = String(id || '').trim();
    if (!value) return null;

    const { data, error } = await db()
        .from('usuarios')
        .select('id,nome,usuario,perfil')
        .eq('id', value)
        .in('perfil', ['admin', 'supremo'])
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('O responsável selecionado precisa possuir perfil de Administrador ou ADM Supremo.');
    return data.id;
}

async function loadAdminDirectory() {
    const { data, error } = await db()
        .from('usuarios')
        .select('id,nome,usuario,perfil,ativo')
        .in('perfil', ['admin', 'supremo'])
        .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
}

function publicAdmin(adminMap, id) {
    if (!id) return null;
    const admin = adminMap.get(id);
    if (!admin) return null;
    return {
        id: admin.id,
        nome: admin.nome,
        usuario: admin.usuario,
        perfil: admin.perfil,
    };
}

export const handler = async (event) => {
    const actor = await requireUser(event, MANAGEMENT_ROLES);
    if (!actor) return json(403, { erro: 'Acesso restrito.' });

    const isSupreme = actor.perfil === 'supremo';
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
        try {
            await expireOverdueAccounts();

            const [{ data, error }, administradores] = await Promise.all([
                db()
                    .from('usuarios')
                    .select('id,usuario,nome,perfil,ativo,status_aprovacao,criado_em,ultimo_acesso,validade_ate,desativado_por_validade,criado_por_admin_id,aprovado_por_admin_id,responsavel_admin_id,vip,vip_desde')
                    .order('criado_em', { ascending: false }),
                loadAdminDirectory(),
            ]);

            if (error) {
                return migrationMissing(error) ? migrationResponse() : json(500, { erro: error.message });
            }

            const adminMap = new Map(administradores.map((admin) => [admin.id, admin]));
            const usuarios = (data || []).map((user) => ({
                ...user,
                vip: Boolean(user.vip),
                acesso_expirado: !user.vip && user.perfil !== 'supremo' && isAccessExpired(user.validade_ate),
                criado_por_admin: publicAdmin(adminMap, user.criado_por_admin_id),
                aprovado_por_admin: publicAdmin(adminMap, user.aprovado_por_admin_id),
                responsavel_admin: publicAdmin(adminMap, user.responsavel_admin_id),
            }));

            return json(200, {
                usuarios,
                administradores,
                permissao: actor.perfil,
            });
        } catch (error) {
            return migrationMissing(error) ? migrationResponse() : json(500, { erro: error.message });
        }
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
        if (!body.usuario || !body.senha || !body.nome) {
            return json(400, { erro: 'Preencha AL SD PM Nº, senha e Nome de Guerra.' });
        }

        const requestedRole = normalizedRole(body);
        if (!isSupreme && requestedRole !== 'aluno') {
            return json(403, { erro: 'Somente o ADM Supremo pode criar administradores.' });
        }

        let validade_ate = null;
        try {
            validade_ate = normalizeValidityDate(body.validade_ate);
        } catch (error) {
            return json(400, { erro: error.message });
        }

        const requestedVip = isSupreme && asBoolean(body.vip);
        if (!requestedVip && isAccessExpired(validade_ate)) {
            return json(400, { erro: 'A validade deve terminar hoje ou em uma data futura.' });
        }

        const senha_hash = await bcrypt.hash(String(body.senha), 12);
        const payload = {
            usuario: String(body.usuario).trim().toLowerCase(),
            nome: String(body.nome).trim(),
            senha_hash,
            perfil: requestedRole,
            ativo: true,
            status_aprovacao: 'aprovado',
            validade_ate,
            desativado_por_validade: false,
            criado_por_admin_id: actor.id,
            aprovado_por_admin_id: actor.id,
            responsavel_admin_id: actor.id,
            vip: false,
            vip_desde: null,
        };

        if (isSupreme && body.responsavel_admin_id !== undefined) {
            try {
                payload.responsavel_admin_id = await validateResponsibleAdmin(body.responsavel_admin_id);
            } catch (error) {
                return json(400, { erro: error.message });
            }
        }

        if (requestedVip) {
            payload.vip = true;
            payload.vip_desde = new Date().toISOString();
            payload.validade_ate = null;
        }

        const { data, error } = await db()
            .from('usuarios')
            .insert(payload)
            .select('id,usuario,nome,perfil,ativo,status_aprovacao,validade_ate,criado_por_admin_id,aprovado_por_admin_id,responsavel_admin_id,vip,vip_desde')
            .single();

        if (error) {
            if (migrationMissing(error)) return migrationResponse();
            return json(400, {
                erro: error.code === '23505' ? 'Esse AL SD PM Nº já existe.' : error.message,
            });
        }

        return json(201, { usuario: data });
    }

    if (event.httpMethod === 'PUT') {
        const id = body.id;
        if (!id) return json(400, { erro: 'Usuário inválido.' });

        const { target, error: targetError } = await findTarget(id);
        if (targetError || !target) return json(404, { erro: 'Usuário não encontrado.' });

        if (target.perfil === 'supremo' && target.id !== actor.id) {
            return json(403, { erro: 'A conta do ADM Supremo é protegida.' });
        }

        if (!canManageTarget(actor, target)) {
            return json(403, {
                erro: target.vip
                    ? 'Usuários VIP só podem ser alterados pelo ADM Supremo.'
                    : 'Administradores comuns só podem alterar contas de alunos.',
            });
        }

        const action = String(body.action || '');

        if (!isSupreme && action && !COMMON_ADMIN_ACTIONS.has(action)) {
            return json(403, { erro: 'Esta operação é permitida somente ao ADM Supremo.' });
        }

        if (action === 'approve') {
            if (target.perfil !== 'aluno') {
                return json(400, { erro: 'Aprovação é aplicável somente a alunos.' });
            }

            const expirado = !target.vip && isAccessExpired(target.validade_ate);
            const { error } = await db()
                .from('usuarios')
                .update({
                    status_aprovacao: 'aprovado',
                    ativo: !expirado,
                    desativado_por_validade: expirado,
                    aprovado_por_admin_id: actor.id,
                    responsavel_admin_id: target.responsavel_admin_id || actor.id,
                })
                .eq('id', id);

            return error
                ? (migrationMissing(error) ? migrationResponse() : json(400, { erro: error.message }))
                : json(200, { ok: true, expirado });
        }

        if (action === 'deny') {
            if (target.perfil !== 'aluno') {
                return json(400, { erro: 'Negação é aplicável somente a alunos.' });
            }

            const { error } = await db()
                .from('usuarios')
                .update(clearSessionFields({ status_aprovacao: 'negado', ativo: false, desativado_por_validade: false }))
                .eq('id', id);

            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (action === 'set_validity') {
            if (target.perfil === 'supremo') {
                return json(403, { erro: 'A conta do ADM Supremo não utiliza prazo de validade.' });
            }
            if (target.vip) {
                return json(403, { erro: 'Usuários VIP possuem acesso vitalício. Remova o status VIP antes de definir validade.' });
            }

            let validade_ate = null;
            try {
                validade_ate = normalizeValidityDate(body.validade_ate);
            } catch (error) {
                return json(400, { erro: error.message });
            }

            if (isAccessExpired(validade_ate)) {
                return json(400, { erro: 'A nova validade deve terminar hoje ou em uma data futura.' });
            }

            const expiredLock = Boolean(target.desativado_por_validade) || (target.ativo && isAccessExpired(target.validade_ate));
            const approved = target.status_aprovacao === 'aprovado';
            const shouldReactivate = approved && (target.ativo || expiredLock);
            const payload = {
                validade_ate,
                ativo: shouldReactivate,
                desativado_por_validade: false,
            };

            if (shouldReactivate) {
                payload.sessao_ativa_id = null;
                payload.sessao_ativa_expira_em = null;
            }

            const { error } = await db().from('usuarios').update(payload).eq('id', id);
            if (error) return migrationMissing(error) ? migrationResponse() : json(400, { erro: error.message });

            return json(200, { ok: true, validade_ate, ativo: payload.ativo });
        }

        if (action === 'toggle_active') {
            if (target.perfil === 'supremo') {
                return json(403, { erro: 'A conta do ADM Supremo deve permanecer ativa.' });
            }

            const nextActive = Boolean(body.ativo);
            if (nextActive && !target.vip && isAccessExpired(target.validade_ate)) {
                return json(400, { erro: 'A validade desta conta expirou. Defina um novo prazo antes de reativá-la.' });
            }

            if (nextActive && target.status_aprovacao !== 'aprovado') {
                return json(400, { erro: 'A conta precisa estar aprovada antes de ser reativada.' });
            }

            const payload = nextActive
                ? { ativo: true, desativado_por_validade: false }
                : clearSessionFields({ ativo: false, desativado_por_validade: false });

            const { error } = await db().from('usuarios').update(payload).eq('id', id);
            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (action === 'update_user') {
            const payload = {};

            if (body.nome !== undefined) {
                const nome = String(body.nome || '').trim();
                if (!nome) return json(400, { erro: 'Informe o Nome de Guerra.' });
                payload.nome = nome;
            }

            if (body.usuario !== undefined) {
                const usuario = String(body.usuario || '').trim().toLowerCase();
                if (!usuario) return json(400, { erro: 'Informe o AL SD PM Nº.' });
                payload.usuario = usuario;
            }

            if (body.senha) {
                if (!isSupreme) {
                    return json(403, { erro: 'Somente o ADM Supremo pode redefinir senhas.' });
                }
                if (String(body.senha).length < 6) {
                    return json(400, { erro: 'A senha deve ter pelo menos 6 caracteres.' });
                }
                payload.senha_hash = await bcrypt.hash(String(body.senha), 12);
                Object.assign(payload, clearSessionFields({}));
            }

            if (body.responsavel_admin_id !== undefined) {
                if (!isSupreme) {
                    return json(403, { erro: 'Somente o ADM Supremo pode escolher o administrador responsável.' });
                }
                try {
                    payload.responsavel_admin_id = await validateResponsibleAdmin(body.responsavel_admin_id);
                } catch (error) {
                    return json(400, { erro: error.message });
                }
            }

            if (body.vip !== undefined) {
                if (!isSupreme) {
                    return json(403, { erro: 'Somente o ADM Supremo pode alterar o status VIP.' });
                }

                const nextVip = asBoolean(body.vip);
                payload.vip = nextVip;
                if (nextVip) {
                    payload.vip_desde = target.vip_desde || new Date().toISOString();
                    payload.validade_ate = null;
                    payload.desativado_por_validade = false;
                    payload.status_aprovacao = 'aprovado';
                    payload.ativo = true;
                } else {
                    payload.vip_desde = null;
                }
            }

            if (!Object.keys(payload).length) {
                return json(400, { erro: 'Nenhuma alteração informada.' });
            }

            const { error } = await db().from('usuarios').update(payload).eq('id', id);
            return error
                ? (migrationMissing(error)
                    ? migrationResponse()
                    : json(400, { erro: error.code === '23505' ? 'Esse AL SD PM Nº já existe.' : error.message }))
                : json(200, { ok: true });
        }

        if (action === 'reset_history' || action === 'reset_ranking') {
            if (!isSupreme) return json(403, { erro: 'Somente o ADM Supremo pode resetar resultados.' });
            const { error } = await db().from('sessoes').delete().eq('usuario_id', id);
            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (action === 'promote_admin') {
            if (!isSupreme) return json(403, { erro: 'Somente o ADM Supremo pode promover administradores.' });
            if (target.perfil !== 'aluno') return json(400, { erro: 'Somente alunos podem ser promovidos.' });

            const expirado = !target.vip && isAccessExpired(target.validade_ate);
            const { error } = await db()
                .from('usuarios')
                .update({
                    perfil: 'admin',
                    status_aprovacao: 'aprovado',
                    ativo: !expirado,
                    desativado_por_validade: expirado,
                    sessao_ativa_id: null,
                    sessao_ativa_expira_em: null,
                })
                .eq('id', id);

            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (action === 'demote_admin') {
            if (!isSupreme) return json(403, { erro: 'Somente o ADM Supremo pode rebaixar administradores.' });
            if (target.perfil !== 'admin') return json(400, { erro: 'A conta selecionada não é administrador.' });

            const expirado = !target.vip && isAccessExpired(target.validade_ate);
            const { error: clearResponsibilityError } = await db()
                .from('usuarios')
                .update({ responsavel_admin_id: null })
                .eq('responsavel_admin_id', id);
            if (clearResponsibilityError) return json(400, { erro: clearResponsibilityError.message });

            const { error } = await db()
                .from('usuarios')
                .update({
                    perfil: 'aluno',
                    status_aprovacao: 'aprovado',
                    ativo: !expirado,
                    desativado_por_validade: expirado,
                    sessao_ativa_id: null,
                    sessao_ativa_expira_em: null,
                })
                .eq('id', id);

            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        return json(400, { erro: 'Ação administrativa inválida.' });
    }

    if (event.httpMethod === 'DELETE') {
        const { target, error: targetError } = await findTarget(params.id);
        if (targetError || !target) return json(404, { erro: 'Usuário não encontrado.' });

        if (target.perfil === 'supremo') {
            return json(403, { erro: 'A conta do ADM Supremo não pode ser apagada.' });
        }

        if (!isSupreme && target.vip) {
            return json(403, { erro: 'Usuários VIP só podem ser apagados pelo ADM Supremo.' });
        }

        if (!isSupreme && target.perfil !== 'aluno') {
            return json(403, { erro: 'Administrador comum só pode apagar alunos.' });
        }

        if (!isSupreme && isProtectedFromCommonAdmin(target)) {
            return json(403, { erro: 'Esta conta é protegida.' });
        }

        const { error } = await db().from('usuarios').delete().eq('id', params.id);
        return error ? json(400, { erro: error.message }) : json(200, { ok: true });
    }

    return json(405, { erro: 'Método não permitido.' });
};
