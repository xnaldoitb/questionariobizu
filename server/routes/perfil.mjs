import bcrypt from 'bcryptjs';
import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { json, parseBody } from '../platform/http.mjs';

export const handler = async (event) => {
    if (event.httpMethod !== 'PUT') return json(405, { erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return json(401, { erro: 'Sessão expirada.' });
    const rate = await consumeRateLimit(event, 'perfil-atualizar', { limit: 8, windowSeconds: 900, failClosed: true }, user.id);
    if (!rate.allowed) return json(rate.unavailable ? 503 : 429, { erro: 'Muitas alterações. Aguarde alguns minutos.' });

    const body = parseBody(event);
    const nome = String(body.nome || '').trim().slice(0, 120);
    const whatsapp = String(body.whatsapp || '').replace(/\D/g, '');
    const senhaAtual = String(body.senha_atual || '');
    const novaSenha = String(body.nova_senha || '');
    if (!nome) return json(400, { erro: 'Informe o Nome de Guerra.' });
    if (whatsapp && !/^55\d{10,11}$/.test(whatsapp)) return json(400, { erro: 'Informe o WhatsApp com código 55 e DDD.' });

    const payload = { nome, whatsapp: whatsapp || null };
    if (senhaAtual || novaSenha) {
        if (!senhaAtual || !novaSenha) return json(400, { erro: 'Informe a senha atual e a nova senha.' });
        if (novaSenha.length < 6 || novaSenha.length > 72) return json(400, { erro: 'A nova senha deve ter entre 6 e 72 caracteres.' });
        if (senhaAtual === novaSenha) return json(400, { erro: 'A nova senha deve ser diferente da senha atual.' });
        const { data: account, error: accountError } = await db().from('usuarios').select('senha_hash').eq('id', user.id).maybeSingle();
        if (accountError || !account) return json(400, { erro: 'Não foi possível validar sua senha.' });
        if (!(await bcrypt.compare(senhaAtual, account.senha_hash))) return json(403, { erro: 'Senha atual incorreta.' });
        payload.senha_hash = await bcrypt.hash(novaSenha, 12);
    }

    const { data, error } = await db().from('usuarios').update(payload).eq('id', user.id)
        .select('id,usuario,nome,whatsapp,perfil,vip,premium,plano_atual,colaborador,xp_total').single();
    if (error) return json(400, { erro: 'Não foi possível atualizar o perfil.' });
    return json(200, { usuario: data, senha_alterada: Boolean(payload.senha_hash) });
};
