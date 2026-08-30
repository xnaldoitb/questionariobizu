import bcrypt from 'bcryptjs';
import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import {
    expireOverdueAccounts,
    isAccessExpired,
    normalizeValidityDate,
} from '../platform/access-validity.mjs';
import { resolveQuestionAccess } from '../platform/question-access.mjs';
import { auditAdmin } from '../platform/admin-audit.mjs';

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
    'premium',
    'acesso_teste',
    'teste_expira_em',
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
        erro: 'Esta versão requer as migrations até a v4.7. Execute supabase/migration-v4.7-teste-30min-acesso-vencido.sql no Supabase antes de publicar.',
        codigo: 'MIGRATION_V47_REQUIRED',
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
    return target?.perfil === 'admin' || target?.perfil === 'supremo';
}

export function canManageTarget(actor, target) {
    if (actor.perfil === 'supremo') return true;
    return target?.perfil === 'aluno' && (
        target.responsavel_admin_id === actor.id
        || (!target.responsavel_admin_id && !target.vip)
    );
}

async function claimUnassignedTarget(actor, target) {
    if (actor.perfil === 'supremo' || target.responsavel_admin_id) return target.responsavel_admin_id === actor.id || actor.perfil === 'supremo';

    const { data, error } = await db()
        .from('usuarios')
        .update({ responsavel_admin_id: actor.id })
        .eq('id', target.id)
        .is('responsavel_admin_id', null)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    if (data) {
        target.responsavel_admin_id = actor.id;
        return true;
    }
    return false;
}

async function audited(actor, action, targetId, response, details = {}) {
    await auditAdmin(actor, action, 'usuario', targetId, details);
    return response;
}

function clearSessionFields(payload) {
    return {
        ...payload,
        sessao_ativa_id: null,
        sessao_ativa_expira_em: null,
        sessao_ativa_device_hash: null,
    };
}

async function revokeDeviceSessions(usuarioId) {
    const { error } = await db().from('sessoes_dispositivo').delete().eq('usuario_id', usuarioId);
    if (error) throw error;
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
    if (!data) throw new Error('O responsável selecionado precisa possuir perfil de Administrador ou Desenvolvedor.');
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

            let usersQuery = db()
                    .from('usuarios')
                    .select('id,usuario,nome,whatsapp,perfil,ativo,status_aprovacao,criado_em,ultimo_acesso,validade_ate,desativado_por_validade,criado_por_admin_id,aprovado_por_admin_id,responsavel_admin_id,vip,premium,vip_desde,acesso_teste,teste_expira_em,teste_ciclo_em,teste_saldo_segundos,teste_ativo_ate');
            if (!isSupreme) {
                usersQuery = usersQuery.or(
                    `responsavel_admin_id.eq.${actor.id},and(responsavel_admin_id.is.null,perfil.eq.aluno,vip.eq.false)`,
                );
            }
            const [{ data, error }, administradores] = await Promise.all([
                usersQuery.order('criado_em', { ascending: false }),
                loadAdminDirectory(),
            ]);

            if (error) {
                console.error('Falha ao listar usuários:', error.message);
                return migrationMissing(error) ? migrationResponse() : json(500, { erro: 'Não foi possível carregar os usuários.' });
            }

            const adminMap = new Map(administradores.map((admin) => [admin.id, admin]));
            const usuarios = (data || []).map((user) => {
                const acesso = resolveQuestionAccess(user);
                return {
                    ...user,
                    vip: Boolean(user.vip),
                    premium: acesso.codigo === 'ACESSO_ATIVO',
                    teste_proximo_em: acesso.teste_proximo_em || null,
                    acesso_restante_ms: acesso.restante_ms || 0,
                    acesso_teste: Boolean(user.acesso_teste),
                    acesso_questoes: Boolean(acesso.permitido),
                    acesso_codigo: acesso.codigo,
                    teste_ativo: acesso.codigo === 'TESTE_ATIVO',
                    teste_disponivel: acesso.codigo === 'TESTE_PAUSADO',
                    teste_expirado: acesso.codigo === 'TESTE_EXPIRADO',
                    acesso_expirado: acesso.codigo === 'ACESSO_VENCIDO',
                    criado_por_admin: publicAdmin(adminMap, user.criado_por_admin_id),
                    aprovado_por_admin: publicAdmin(adminMap, user.aprovado_por_admin_id),
                    responsavel_admin: publicAdmin(adminMap, user.responsavel_admin_id),
                };
            });

            return json(200, {
                usuarios,
                administradores,
                permissao: actor.perfil,
            });
        } catch (error) {
            console.error('Falha administrativa:', error.message);
            return migrationMissing(error) ? migrationResponse() : json(500, { erro: 'Não foi possível concluir a operação administrativa.' });
        }
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
        if (!body.usuario || !body.senha || !body.nome) {
            return json(400, { erro: 'Preencha AL SD PM Nº, senha e Nome de Guerra.' });
        }
        if (String(body.senha).length < 6 || String(body.senha).length > 72) {
            return json(400, { erro: 'A senha deve ter entre 6 e 72 caracteres.' });
        }

        const requestedRole = normalizedRole(body);
        if (!isSupreme && requestedRole !== 'aluno') {
            return json(403, { erro: 'Somente o Desenvolvedor pode criar administradores.' });
        }

        let validade_ate = null;
        try {
            validade_ate = normalizeValidityDate(body.validade_ate);
        } catch (error) {
            return json(400, { erro: error.message });
        }

        const requestedVip = asBoolean(body.vip);
        if (!requestedVip && isAccessExpired(validade_ate)) {
            return json(400, { erro: 'A validade deve terminar hoje ou em uma data futura.' });
        }

        const senha_hash = await bcrypt.hash(String(body.senha), 12);
        const whatsapp = String(body.whatsapp || '').replace(/\D/g, '');
        if (whatsapp && !/^55\d{10,11}$/.test(whatsapp)) {
            return json(400, { erro: 'Informe o WhatsApp com código 55 e DDD.' });
        }
        const payload = {
            usuario: String(body.usuario).trim().toLowerCase(),
            nome: String(body.nome).trim(),
            senha_hash,
            whatsapp: whatsapp || null,
            perfil: requestedRole,
            ativo: true,
            status_aprovacao: 'aprovado',
            validade_ate,
            desativado_por_validade: false,
            criado_por_admin_id: actor.id,
            aprovado_por_admin_id: actor.id,
            responsavel_admin_id: actor.id,
            vip: false,
            premium: Boolean(validade_ate) && !requestedVip,
            vip_desde: null,
            acesso_teste: false,
            teste_expira_em: null,
            teste_ciclo_em: !validade_ate && !requestedVip ? new Date().toISOString() : null,
            teste_saldo_segundos: !validade_ate && !requestedVip ? 0 : 1800,
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
            .select('id,usuario,nome,whatsapp,perfil,ativo,status_aprovacao,validade_ate,criado_por_admin_id,aprovado_por_admin_id,responsavel_admin_id,vip,premium,vip_desde,acesso_teste,teste_expira_em')
            .single();

        if (error) {
            if (migrationMissing(error)) return migrationResponse();
            return json(400, {
                erro: error.code === '23505' ? 'Esse AL SD PM Nº já existe.' : 'Não foi possível criar o usuário.',
            });
        }

        return audited(actor, 'usuario_criado', data.id, json(201, { usuario: data }), {
            perfil: data.perfil,
        });
    }

    if (event.httpMethod === 'PUT') {
        const id = body.id;
        if (!id) return json(400, { erro: 'Usuário inválido.' });

        const { target, error: targetError } = await findTarget(id);
        if (targetError || !target) return json(404, { erro: 'Usuário não encontrado.' });

        if (target.perfil === 'supremo' && target.id !== actor.id) {
            return json(403, { erro: 'A conta do Desenvolvedor é protegida.' });
        }

        if (!canManageTarget(actor, target)) {
            return json(403, {
                erro: target.perfil !== 'aluno'
                    ? 'Administradores comuns só podem alterar contas de alunos.'
                    : 'Este usuário está sob responsabilidade de outro administrador.',
            });
        }

        const action = String(body.action || '');

        if (!isSupreme && action && !COMMON_ADMIN_ACTIONS.has(action)) {
            return json(403, { erro: 'Esta operação é permitida somente ao Desenvolvedor.' });
        }

        if (!isSupreme && !target.responsavel_admin_id) {
            const claimed = await claimUnassignedTarget(actor, target);
            if (!claimed) {
                return json(409, { erro: 'Este usuário acabou de ser assumido por outro administrador. Atualize a lista.' });
            }
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
                    ativo: true,
                    desativado_por_validade: expirado,
                    aprovado_por_admin_id: actor.id,
                    responsavel_admin_id: target.responsavel_admin_id || actor.id,
                    acesso_teste: false,
                })
                .eq('id', id);

            return error
                ? (migrationMissing(error) ? migrationResponse() : json(400, { erro: 'Não foi possível aprovar o usuário.' }))
                : audited(actor, 'usuario_aprovado', id, json(200, { ok: true, expirado }));
        }

        if (action === 'deny') {
            if (target.perfil !== 'aluno') {
                return json(400, { erro: 'Negação é aplicável somente a alunos.' });
            }

            await revokeDeviceSessions(id);
            const { error } = await db()
                .from('usuarios')
                .update(clearSessionFields({ status_aprovacao: 'negado', ativo: false, desativado_por_validade: false }))
                .eq('id', id);

            return error ? json(400, { erro: 'Não foi possível negar o cadastro.' })
                : audited(actor, 'usuario_negado', id, json(200, { ok: true }));
        }

        if (action === 'set_validity') {
            if (target.perfil === 'supremo') {
                return json(403, { erro: 'A conta do Desenvolvedor não utiliza prazo de validade.' });
            }
            const vitalicio = body.vitalicio === true;

            let validade_ate = null;
            try {
                validade_ate = vitalicio ? null : normalizeValidityDate(body.validade_ate);
            } catch (error) {
                return json(400, { erro: error.message });
            }

            if (isAccessExpired(validade_ate)) {
                return json(400, { erro: 'A nova validade deve terminar hoje ou em uma data futura.' });
            }

            const expiredLock = Boolean(target.desativado_por_validade) || (target.ativo && isAccessExpired(target.validade_ate));
            const approved = target.status_aprovacao === 'aprovado' || Boolean(target.acesso_teste);
            const shouldReactivate = approved && (target.ativo || expiredLock || target.acesso_teste);
            const payload = {
                validade_ate,
                vip: vitalicio,
                vip_desde: vitalicio ? (target.vip_desde || new Date().toISOString()) : null,
                premium: Boolean(validade_ate) && !vitalicio,
                ativo: shouldReactivate,
                desativado_por_validade: false,
                acesso_teste: !validade_ate && !vitalicio,
                teste_ativo_ate: null,
            };
            if (!validade_ate && !vitalicio) {
                payload.teste_ciclo_em = new Date().toISOString();
                payload.teste_saldo_segundos = 0;
            }

            // Para cadastro de teste, definir validade também funciona como liberação:
            // registra o ADM aprovador e mantém a responsabilidade rastreável.
            if (target.acesso_teste) {
                payload.status_aprovacao = 'aprovado';
                payload.aprovado_por_admin_id = actor.id;
                payload.responsavel_admin_id = target.responsavel_admin_id || actor.id;
            }

            // A sessão permanece válida: a nova permissão é lida automaticamente.

            const { error } = await db().from('usuarios').update(payload).eq('id', id);
            if (error) return migrationMissing(error) ? migrationResponse() : json(400, { erro: 'Não foi possível alterar a validade.' });

            return audited(actor, 'validade_alterada', id, json(200, { ok: true, validade_ate, ativo: payload.ativo }), {
                vitalicio,
                possui_validade: Boolean(validade_ate),
            });
        }

        if (action === 'toggle_active') {
            if (target.perfil === 'supremo') {
                return json(403, { erro: 'A conta do Desenvolvedor deve permanecer ativa.' });
            }

            const nextActive = Boolean(body.ativo);
            if (nextActive && target.status_aprovacao !== 'aprovado') {
                return json(400, { erro: 'A conta precisa estar aprovada antes de ser reativada.' });
            }

            const payload = nextActive
                ? { ativo: true, desativado_por_validade: false }
                : clearSessionFields({ ativo: false, desativado_por_validade: false });

            if (!nextActive) await revokeDeviceSessions(id);

            const { error } = await db().from('usuarios').update(payload).eq('id', id);
            return error ? json(400, { erro: 'Não foi possível alterar a situação da conta.' })
                : audited(actor, 'situacao_alterada', id, json(200, { ok: true }), { ativo: nextActive });
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

            if (body.whatsapp !== undefined) {
                const whatsapp = String(body.whatsapp || '').replace(/\D/g, '');
                if (whatsapp && !/^55\d{10,11}$/.test(whatsapp)) {
                    return json(400, { erro: 'Informe o WhatsApp com código 55 e DDD.' });
                }
                payload.whatsapp = whatsapp || null;
            }

            if (body.senha) {
                if (!isSupreme) {
                    return json(403, { erro: 'Somente o Desenvolvedor pode redefinir senhas.' });
                }
                if (String(body.senha).length < 6 || String(body.senha).length > 72) {
                    return json(400, { erro: 'A senha deve ter entre 6 e 72 caracteres.' });
                }
                payload.senha_hash = await bcrypt.hash(String(body.senha), 12);
                Object.assign(payload, clearSessionFields({}));
                await revokeDeviceSessions(id);
            }

            if (body.responsavel_admin_id !== undefined) {
                if (!isSupreme) {
                    return json(403, { erro: 'Somente o Desenvolvedor pode escolher o administrador responsável.' });
                }
                try {
                    payload.responsavel_admin_id = await validateResponsibleAdmin(body.responsavel_admin_id);
                } catch (error) {
                    return json(400, { erro: error.message });
                }
            }

            if (body.vip !== undefined) {
                const nextVip = asBoolean(body.vip);
                payload.vip = nextVip;
                if (nextVip) {
                    payload.vip_desde = target.vip_desde || new Date().toISOString();
                    payload.premium = false;
                    payload.validade_ate = null;
                    payload.desativado_por_validade = false;
                    payload.status_aprovacao = 'aprovado';
                    payload.ativo = true;
                    payload.acesso_teste = false;
                    if (target.acesso_teste) {
                        payload.aprovado_por_admin_id = actor.id;
                        payload.responsavel_admin_id = target.responsavel_admin_id || actor.id;
                    }
                } else {
                    payload.vip_desde = null;
                    payload.premium = false;
                    payload.validade_ate = null;
                    payload.acesso_teste = true;
                    payload.teste_ativo_ate = null;
                    payload.teste_ciclo_em = new Date().toISOString();
                    payload.teste_saldo_segundos = 0;
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
                : audited(actor, body.senha ? 'senha_redefinida' : 'usuario_editado', id, json(200, { ok: true }));
        }

        if (action === 'reset_history' || action === 'reset_ranking') {
            if (!isSupreme) return json(403, { erro: 'Somente o Desenvolvedor pode resetar resultados.' });
            const { error } = await db().from('sessoes').delete().eq('usuario_id', id);
            return error ? json(400, { erro: 'Não foi possível redefinir os resultados.' })
                : audited(actor, 'resultados_redefinidos', id, json(200, { ok: true }));
        }

        if (action === 'promote_admin') {
            if (!isSupreme) return json(403, { erro: 'Somente o Desenvolvedor pode promover administradores.' });
            if (target.perfil !== 'aluno') return json(400, { erro: 'Somente alunos podem ser promovidos.' });

            const expirado = !target.vip && isAccessExpired(target.validade_ate);
            await revokeDeviceSessions(id);
            const { error } = await db()
                .from('usuarios')
                .update({
                    perfil: 'admin',
                    status_aprovacao: 'aprovado',
                    ativo: true,
                    desativado_por_validade: expirado,
                    sessao_ativa_id: null,
                    sessao_ativa_expira_em: null,
                    sessao_ativa_device_hash: null,
                })
                .eq('id', id);

            return error ? json(400, { erro: 'Não foi possível promover o usuário.' })
                : audited(actor, 'usuario_promovido', id, json(200, { ok: true }));
        }

        if (action === 'demote_admin') {
            if (!isSupreme) return json(403, { erro: 'Somente o Desenvolvedor pode rebaixar administradores.' });
            if (target.perfil !== 'admin') return json(400, { erro: 'A conta selecionada não é administrador.' });

            const expirado = !target.vip && isAccessExpired(target.validade_ate);
            await revokeDeviceSessions(id);
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
                    ativo: true,
                    desativado_por_validade: expirado,
                    sessao_ativa_id: null,
                    sessao_ativa_expira_em: null,
                    sessao_ativa_device_hash: null,
                })
                .eq('id', id);

            return error ? json(400, { erro: 'Não foi possível rebaixar o administrador.' })
                : audited(actor, 'administrador_rebaixado', id, json(200, { ok: true }));
        }

        return json(400, { erro: 'Ação administrativa inválida.' });
    }

    if (event.httpMethod === 'DELETE') {
        const { target, error: targetError } = await findTarget(params.id);
        if (targetError || !target) return json(404, { erro: 'Usuário não encontrado.' });

        if (target.perfil === 'supremo') {
            return json(403, { erro: 'A conta do Desenvolvedor não pode ser apagada.' });
        }

        if (!isSupreme && target.responsavel_admin_id !== actor.id) {
            return json(403, { erro: 'Este usuário não está sob sua responsabilidade.' });
        }

        if (!isSupreme && target.perfil !== 'aluno') {
            return json(403, { erro: 'Administrador comum só pode apagar alunos.' });
        }

        if (!isSupreme && isProtectedFromCommonAdmin(target)) {
            return json(403, { erro: 'Esta conta é protegida.' });
        }

        const { error } = await db().from('usuarios').delete().eq('id', params.id);
        return error ? json(400, { erro: 'Não foi possível apagar o usuário.' })
            : audited(actor, 'usuario_excluido', params.id, json(200, { ok: true }));
    }

    return json(405, { erro: 'Método não permitido.' });
};
