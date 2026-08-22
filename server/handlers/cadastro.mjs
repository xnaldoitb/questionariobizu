import bcrypt from 'bcryptjs';
import { db } from '../lib/db.mjs';
import { json, parseBody } from '../lib/http.mjs';
import { consumeRateLimit } from '../lib/rate-limit.mjs';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return json(405, { erro: 'Método não permitido.' });
    }

    const rate = await consumeRateLimit(event, 'cadastro', { limit: 5, windowSeconds: 60 * 60 });
    if (!rate.allowed) {
        return json(429, { erro: 'Muitas tentativas de cadastro. Aguarde e tente novamente mais tarde.' }, { 'retry-after': '3600' });
    }

    const body = parseBody(event);
    const usuario = String(body.usuario || '').trim().toLowerCase();
    const nome = String(body.nome || '').trim();
    const senha = String(body.senha || '');

    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
        return json(400, {
            erro: 'Use de 3 a 30 caracteres no AL SD PM Nº: letras, números, ponto, hífen ou sublinhado.',
        });
    }

    if (nome.length < 2) {
        return json(400, { erro: 'Informe o Nome de Guerra.' });
    }

    if (senha.length < 6) {
        return json(400, { erro: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const senha_hash = await bcrypt.hash(senha, 12);
    const { data, error } = await db()
        .from('usuarios')
        .insert({
            usuario,
            nome,
            senha_hash,
            perfil: 'aluno',
            ativo: false,
            status_aprovacao: 'pendente',
        })
        .select('id,usuario,nome,perfil,ativo,status_aprovacao')
        .single();

    if (error) {
        return json(400, {
            erro: error.code === '23505'
                ? 'Esse AL SD PM Nº já possui cadastro.'
                : error.message,
        });
    }

    return json(201, {
        ok: true,
        pendente: true,
        usuario: data,
        mensagem: 'Cadastro enviado. Aguarde a aprovação de um administrador para entrar.',
    });
};
