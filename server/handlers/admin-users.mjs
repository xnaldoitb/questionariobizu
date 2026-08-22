import bcrypt from 'bcryptjs';
import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json, parseBody } from '../lib/http.mjs';

const MANAGEMENT_ROLES = ['admin', 'supremo'];

async function findTarget(id) {
    const { data, error } = await db()
        .from('usuarios')
        .select('id,usuario,nome,perfil,ativo,status_aprovacao')
        .eq('id', id)
        .maybeSingle();

    return { target: data, error };
}

function isProtectedFromCommonAdmin(target) {
    return target?.perfil === 'admin' || target?.perfil === 'supremo';
}

function canCommonAdminAction(action) {
    return ['approve', 'deny'].includes(action);
}

export const handler = async (event) => {
    const actor = await requireUser(event, MANAGEMENT_ROLES);
    if (!actor) return json(403, { erro: 'Acesso restrito.' });

    const isSupreme = actor.perfil === 'supremo';
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
        const { data, error } = await db()
            .from('usuarios')
            .select('id,usuario,nome,perfil,ativo,status_aprovacao,criado_em,ultimo_acesso')
            .order('criado_em', { ascending: false });

        return error
            ? json(500, { erro: error.message })
            : json(200, { usuarios: data, permissao: actor.perfil });
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
        if (!body.usuario || !body.senha || !body.nome) {
            return json(400, { erro: 'Preencha AL SD PM Nº, senha e Nome de Guerra.' });
        }

        const requestedRole = body.perfil === 'admin' ? 'admin' : 'aluno';
        if (!isSupreme && requestedRole !== 'aluno') {
            return json(403, { erro: 'Somente o ADM Supremo pode criar administradores.' });
        }

        const senha_hash = await bcrypt.hash(String(body.senha), 12);
        const { data, error } = await db()
            .from('usuarios')
            .insert({
                usuario: String(body.usuario).trim().toLowerCase(),
                nome: String(body.nome).trim(),
                senha_hash,
                perfil: requestedRole,
                ativo: true,
                status_aprovacao: 'aprovado',
            })
            .select('id,usuario,nome,perfil,ativo,status_aprovacao')
            .single();

        return error
            ? json(400, { erro: error.code === '23505' ? 'Esse AL SD PM Nº já existe.' : error.message })
            : json(201, { usuario: data });
    }

    if (event.httpMethod === 'PUT') {
        const id = body.id;
        if (!id) return json(400, { erro: 'Usuário inválido.' });

        const { target, error: targetError } = await findTarget(id);
        if (targetError || !target) return json(404, { erro: 'Usuário não encontrado.' });

        if (target.perfil === 'supremo' && target.id !== actor.id) {
            return json(403, { erro: 'A conta do ADM Supremo é protegida.' });
        }

        if (!isSupreme && isProtectedFromCommonAdmin(target)) {
            return json(403, { erro: 'Administradores comuns não podem alterar contas administrativas.' });
        }

        const action = String(body.action || '');

        if (!isSupreme && action && !canCommonAdminAction(action)) {
            return json(403, {
                erro: 'Administrador comum pode somente aprovar ou negar cadastros de alunos.',
            });
        }

        if (action === 'approve') {
            if (target.perfil !== 'aluno') return json(400, { erro: 'Aprovação é aplicável somente a alunos.' });
            const { error } = await db()
                .from('usuarios')
                .update({ status_aprovacao: 'aprovado', ativo: true })
                .eq('id', id);
            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (action === 'deny') {
            if (target.perfil !== 'aluno') return json(400, { erro: 'Negação é aplicável somente a alunos.' });
            const { error } = await db()
                .from('usuarios')
                .update({ status_aprovacao: 'negado', ativo: false })
                .eq('id', id);
            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (action === 'reset_history' || action === 'reset_ranking') {
            if (!isSupreme) return json(403, { erro: 'Somente o ADM Supremo pode resetar resultados.' });
            const { error } = await db().from('sessoes').delete().eq('usuario_id', id);
            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (action === 'promote_admin') {
            if (!isSupreme) return json(403, { erro: 'Somente o ADM Supremo pode promover administradores.' });
            if (target.perfil !== 'aluno') return json(400, { erro: 'Somente alunos podem ser promovidos.' });
            const { error } = await db()
                .from('usuarios')
                .update({ perfil: 'admin', status_aprovacao: 'aprovado', ativo: true })
                .eq('id', id);
            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (action === 'demote_admin') {
            if (!isSupreme) return json(403, { erro: 'Somente o ADM Supremo pode rebaixar administradores.' });
            if (target.perfil !== 'admin') return json(400, { erro: 'A conta selecionada não é administrador.' });
            const { error } = await db()
                .from('usuarios')
                .update({ perfil: 'aluno', status_aprovacao: 'aprovado', ativo: true })
                .eq('id', id);
            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (!isSupreme) {
            return json(403, { erro: 'Operação permitida somente ao ADM Supremo.' });
        }

        const requestedRole = body.perfil === 'admin' ? 'admin' : target.perfil;
        if (requestedRole === 'supremo') {
            return json(400, { erro: 'Não é permitido criar outro ADM Supremo por esta operação.' });
        }

        const payload = {
            nome: body.nome || target.nome,
            perfil: target.perfil === 'supremo' ? 'supremo' : requestedRole,
            ativo: target.perfil === 'supremo' ? true : Boolean(body.ativo),
            status_aprovacao: target.perfil === 'supremo' ? 'aprovado' : (body.status_aprovacao || target.status_aprovacao),
        };

        if (body.senha) payload.senha_hash = await bcrypt.hash(String(body.senha), 12);

        const { error } = await db().from('usuarios').update(payload).eq('id', id);
        return error ? json(400, { erro: error.message }) : json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE') {
        const { target, error: targetError } = await findTarget(params.id);
        if (targetError || !target) return json(404, { erro: 'Usuário não encontrado.' });

        if (target.perfil === 'supremo') {
            return json(403, { erro: 'A conta do ADM Supremo não pode ser apagada.' });
        }

        if (!isSupreme && target.perfil !== 'aluno') {
            return json(403, { erro: 'Administrador comum só pode apagar alunos.' });
        }

        if (!isSupreme && isProtectedFromCommonAdmin(target)) {
            return json(403, { erro: 'Contas administrativas são protegidas.' });
        }

        const { error } = await db().from('usuarios').delete().eq('id', params.id);
        return error ? json(400, { erro: error.message }) : json(200, { ok: true });
    }

    return json(405, { erro: 'Método não permitido.' });
};
