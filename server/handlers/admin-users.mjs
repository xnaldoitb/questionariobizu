import bcrypt from 'bcryptjs';
import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json, parseBody } from '../lib/http.mjs';

async function findTarget(id) {
    const { data, error } = await db().from('usuarios').select('id,usuario,nome,perfil,ativo').eq('id', id).maybeSingle();
    return { target: data, error };
}

export const handler = async (event) => {
    const admin = await requireUser(event, 'admin');
    if (!admin) return json(403, { erro: 'Acesso restrito.' });

    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
        const { data, error } = await db()
            .from('usuarios')
            .select('id,usuario,nome,perfil,ativo,criado_em,ultimo_acesso')
            .order('criado_em', { ascending: false });
        return error ? json(500, { erro: error.message }) : json(200, { usuarios: data });
    }

    const body = parseBody(event);

    if (event.httpMethod === 'POST') {
        if (!body.usuario || !body.senha || !body.nome) {
            return json(400, { erro: 'Preencha AL SD PM Nº, senha e Nome de Guerra.' });
        }
        const senha_hash = await bcrypt.hash(String(body.senha), 12);
        const { data, error } = await db()
            .from('usuarios')
            .insert({
                usuario: String(body.usuario).trim().toLowerCase(),
                nome: body.nome,
                senha_hash,
                perfil: body.perfil === 'admin' ? 'admin' : 'aluno'
            })
            .select('id,usuario,nome,perfil,ativo')
            .single();
        return error ? json(400, { erro: error.message }) : json(201, { usuario: data });
    }

    if (event.httpMethod === 'PUT') {
        const id = body.id;
        if (!id) return json(400, { erro: 'Usuário inválido.' });

        const { target, error: targetError } = await findTarget(id);
        if (targetError || !target) return json(404, { erro: 'Usuário não encontrado.' });

        if (body.action === 'reset_history' || body.action === 'reset_ranking') {
            const { error } = await db().from('sessoes').delete().eq('usuario_id', id);
            return error ? json(400, { erro: error.message }) : json(200, { ok: true });
        }

        if (target.perfil === 'admin' && body.ativo === false) {
            return json(400, { erro: 'Contas administrativas não podem ser bloqueadas.' });
        }

        const payload = {
            nome: body.nome || target.nome,
            perfil: target.perfil === 'admin' ? 'admin' : (body.perfil === 'admin' ? 'admin' : 'aluno'),
            ativo: target.perfil === 'admin' ? true : Boolean(body.ativo)
        };
        if (body.senha) payload.senha_hash = await bcrypt.hash(String(body.senha), 12);

        const { error } = await db().from('usuarios').update(payload).eq('id', id);
        return error ? json(400, { erro: error.message }) : json(200, { ok: true });
    }

    if (event.httpMethod === 'DELETE') {
        const { target, error: targetError } = await findTarget(params.id);
        if (targetError || !target) return json(404, { erro: 'Usuário não encontrado.' });
        if (target.perfil === 'admin') return json(400, { erro: 'Contas administrativas não podem ser apagadas.' });

        const { error } = await db().from('usuarios').delete().eq('id', params.id);
        return error ? json(400, { erro: error.message }) : json(200, { ok: true });
    }

    return json(405, { erro: 'Método não permitido.' });
};
