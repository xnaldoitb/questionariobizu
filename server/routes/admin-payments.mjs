import { requireUser } from '../platform/auth.mjs';
import { db } from '../platform/db.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { createCheckoutPreference, loadPlan, loadPlans } from '../platform/payments.mjs';
import { auditAdmin } from '../platform/admin-audit.mjs';

const ROLES = ['admin', 'supremo'];

function slug(value) {
    return String(value || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

async function targetUser(id) {
    const { data, error } = await db().from('usuarios')
        .select('id,nome,usuario,whatsapp,perfil,vip,responsavel_admin_id,validade_ate')
        .eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

export function canManage(actor, target) {
    if (actor.perfil === 'supremo') return true;
    return target?.perfil === 'aluno' && (
        target.responsavel_admin_id === actor.id
        || (!target.responsavel_admin_id && !target.vip)
    );
}

async function claimUnassignedTarget(actor, target) {
    if (actor.perfil === 'supremo' || target.responsavel_admin_id) return target.responsavel_admin_id === actor.id || actor.perfil === 'supremo';
    const { data, error } = await db().from('usuarios')
        .update({ responsavel_admin_id: actor.id })
        .eq('id', target.id)
        .is('responsavel_admin_id', null)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    if (data) target.responsavel_admin_id = actor.id;
    return Boolean(data);
}

async function loadPaymentHistory(actor) {
    let allowedUserIds = null;
    if (actor.perfil !== 'supremo') {
        const owned = await db().from('usuarios').select('id').eq('responsavel_admin_id', actor.id);
        if (owned.error) throw owned.error;
        allowedUserIds = (owned.data || []).map((user) => user.id);
        if (!allowedUserIds.length) return [];
    }
    let paymentQuery = db().from('pagamentos')
        .select('id,usuario_id,plano,plano_nome,valor,duracao_dias,acesso_permanente,status,origem,mercado_pago_preference_id,mercado_pago_payment_id,criado_em,atualizado_em,aprovado_em,aplicado_em,criado_por_admin_id');
    if (allowedUserIds) paymentQuery = paymentQuery.in('usuario_id', allowedUserIds);
    const { data: payments, error } = await paymentQuery.order('criado_em', { ascending: false }).limit(500);
    if (error) throw error;

    const ids = [...new Set((payments || []).map((item) => item.usuario_id).filter(Boolean))];
    let users = [];
    if (ids.length) {
        const result = await db().from('usuarios')
            .select('id,nome,usuario,whatsapp,responsavel_admin_id,validade_ate,vip')
            .in('id', ids);
        if (result.error) throw result.error;
        users = result.data || [];
    }
    const map = new Map(users.map((user) => [user.id, user]));
    return (payments || []).map((payment) => ({ ...payment, usuario: map.get(payment.usuario_id) || null }));
}

export const handler = async (event) => {
    const actor = await requireUser(event, ROLES);
    if (!actor) return json(403, { erro: 'Acesso restrito.' });

    if (event.httpMethod === 'GET') {
        const [planos, pagamentos] = await Promise.all([
            loadPlans({ activeOnly: false }),
            loadPaymentHistory(actor),
        ]);
        return json(200, { planos, pagamentos, permissao: actor.perfil });
    }

    if (event.httpMethod !== 'POST') return json(405, { erro: 'Método não permitido.' });
    const body = parseBody(event);
    const action = String(body.action || '');

    if (action === 'save_plan') {
        if (actor.perfil !== 'supremo') return json(403, { erro: 'Somente o Desenvolvedor pode alterar planos.' });
        const nome = String(body.nome || '').trim();
        const id = String(body.id || slug(nome));
        const preco = Number(body.preco);
        const permanente = Boolean(body.acesso_permanente);
        const dias = permanente ? null : Number(body.duracao_dias);
        const ordem = Number(body.ordem || 0);
        if (!/^[a-z0-9_-]{3,40}$/.test(id)) return json(400, { erro: 'Código do plano inválido.' });
        if (nome.length < 3) return json(400, { erro: 'Informe o nome do plano.' });
        if (!Number.isFinite(preco) || preco <= 0 || preco > 100000) return json(400, { erro: 'Preço inválido.' });
        if (!permanente && (!Number.isInteger(dias) || dias <= 0 || dias > 36500)) return json(400, { erro: 'Duração em dias inválida.' });

        const payload = { id, nome, preco, duracao_dias: dias, acesso_permanente: permanente, ordem, ativo: body.ativo !== false, atualizado_em: new Date().toISOString() };
        const { data, error } = await db().from('planos_acesso').upsert(payload).select('*').single();
        if (error) return json(400, { erro: 'Não foi possível salvar o plano.' });
        await auditAdmin(actor, 'plano_salvo', 'plano', data.id, { ativo: data.ativo });
        return json(200, { plano: data });
    }

    if (action === 'toggle_plan') {
        if (actor.perfil !== 'supremo') return json(403, { erro: 'Somente o Desenvolvedor pode ativar ou desativar planos.' });
        const { error } = await db().from('planos_acesso')
            .update({ ativo: Boolean(body.ativo), atualizado_em: new Date().toISOString() })
            .eq('id', String(body.id || ''));
        if (error) return json(400, { erro: 'Não foi possível alterar o plano.' });
        await auditAdmin(actor, 'plano_situacao_alterada', 'plano', body.id, { ativo: Boolean(body.ativo) });
        return json(200, { ok: true });
    }

    const target = await targetUser(body.usuario_id);
    if (!target) return json(404, { erro: 'Usuário não encontrado.' });
    if (!canManage(actor, target)) return json(403, { erro: 'Você não pode alterar o acesso deste usuário.' });
    if (actor.perfil !== 'supremo' && !target.responsavel_admin_id) {
        const claimed = await claimUnassignedTarget(actor, target);
        if (!claimed) return json(409, { erro: 'Este usuário acabou de ser assumido por outro administrador. Atualize a lista.' });
    }
    const plan = await loadPlan(String(body.plano_id || ''));
    if (!plan) return json(400, { erro: 'Plano inválido ou inativo.' });

    if (action === 'manual_grant') {
        const { data, error } = await db().rpc('conceder_acesso_plano', {
            p_usuario_id: target.id,
            p_plano_id: plan.id,
            p_admin_id: actor.id,
        });
        if (error) return json(400, { erro: 'Não foi possível conceder o plano.' });
        await auditAdmin(actor, 'acesso_manual_concedido', 'pagamento', null, {
            usuario_id: target.id,
            plano_id: plan.id,
        });
        return json(200, { resultado: data });
    }

    if (action === 'generate_charge') {
        const payment = await createCheckoutPreference({ event, user: target, plan });
        await auditAdmin(actor, 'cobranca_gerada', 'pagamento', payment.pagamento_id, {
            usuario_id: target.id,
            plano_id: plan.id,
        });
        return json(201, { ...payment, whatsapp: target.whatsapp, usuario_nome: target.nome });
    }

    return json(400, { erro: 'Ação administrativa inválida.' });
};
