import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { db } from '../platform/db.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return json(405, { erro: 'Método não permitido.' });
    }

    const body = parseBody(event);
    const usuario = String(body.usuario || '').trim().toLowerCase();
    const nome = String(body.nome || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
    const senha = String(body.senha || '');
    const whatsapp = String(body.whatsapp || '').replace(/\D/g, '');
    const deviceToken = String(event.headers?.['x-client-device'] || event.headers?.['X-Client-Device'] || '').trim();
    const formStartedAt = Number(body.form_started_at || 0);
    const elapsed = Date.now() - formStartedAt;

    if (String(body.website || '').trim() || !Number.isFinite(elapsed) || elapsed < 1500 || elapsed > 2 * 60 * 60 * 1000) {
        return json(400, { erro: 'Não foi possível validar o cadastro. Atualize a página e tente novamente.' });
    }

    if (!/^[a-zA-Z0-9-]{20,100}$/.test(deviceToken)) {
        return json(400, { erro: 'Não foi possível identificar este navegador. Atualize a página e tente novamente.' });
    }

    const limits = await Promise.all([
        consumeRateLimit(event, 'cadastro-ip-hora', { limit: 4, windowSeconds: 60 * 60, failClosed: true }),
        consumeRateLimit(event, 'cadastro-ip-dia', { limit: 10, windowSeconds: 24 * 60 * 60, failClosed: true }),
        consumeRateLimit(event, 'cadastro-dispositivo', { limit: 2, windowSeconds: 30 * 24 * 60 * 60, failClosed: true, includeIp: false }, deviceToken),
        consumeRateLimit(event, 'cadastro-whatsapp', { limit: 3, windowSeconds: 24 * 60 * 60, failClosed: true, includeIp: false }, whatsapp),
    ]);

    if (limits.some((rate) => !rate.allowed)) {
        const unavailable = limits.some((rate) => rate.unavailable);
        return json(
            unavailable ? 503 : 429,
            { erro: unavailable
                ? 'A proteção de cadastro está temporariamente indisponível. Tente novamente em alguns minutos.'
                : 'Limite de cadastros atingido neste dispositivo ou rede. Procure um administrador se precisar de ajuda.' },
            unavailable ? {} : { 'retry-after': '3600' },
        );
    }

    if (!/^\d{3,12}$/.test(usuario)) {
        return json(400, {
            erro: 'O AL SD PM Nº deve conter de 3 a 12 números.',
        });
    }

    if (nome.length < 2 || nome.length > 50) {
        return json(400, { erro: 'Informe o Nome de Guerra.' });
    }

    if (senha.length < 6 || senha.length > 72) {
        return json(400, { erro: 'A senha deve ter entre 6 e 72 caracteres.' });
    }

    if (!/^55\d{10,11}$/.test(whatsapp)) {
        return json(400, { erro: 'Informe um WhatsApp válido com DDD. Ex.: 5591982575188.' });
    }

    const deviceHash = createHash('sha256').update(deviceToken).digest('hex');
    const { data: existing, error: lookupError } = await db()
        .from('usuarios')
        .select('id')
        .or(`usuario.eq.${usuario},whatsapp.eq.${whatsapp},cadastro_device_hash.eq.${deviceHash}`)
        .limit(1);

    if (lookupError) {
        console.error('Falha ao verificar duplicidade de cadastro:', lookupError);
        return json(503, { erro: 'Não foi possível validar o cadastro agora. Tente novamente em alguns minutos.' });
    }

    if (existing?.length) {
        return json(409, { erro: 'Estes dados já estão vinculados a um cadastro. Procure um administrador para recuperar o acesso.' });
    }

    const senha_hash = await bcrypt.hash(senha, 12);
    const { data, error } = await db()
        .from('usuarios')
        .insert({
            usuario,
            nome,
            senha_hash,
            whatsapp,
            cadastro_device_hash: deviceHash,
            perfil: 'aluno',
            ativo: true,
            status_aprovacao: 'pendente',
            acesso_teste: true,
            teste_expira_em: null,
            validade_ate: null,
            desativado_por_validade: false,
        })
        .select('id,usuario,nome,perfil,ativo,status_aprovacao,acesso_teste,teste_expira_em')
        .single();

    if (error) {
        return json(error.code === '23505' ? 409 : 400, {
            erro: error.code === '23505'
                ? 'Estes dados já estão vinculados a um cadastro. Procure um administrador para recuperar o acesso.'
                : 'Não foi possível concluir o cadastro. Confira os dados e tente novamente.',
        });
    }

    return json(201, {
        ok: true,
        pendente: true,
        teste: true,
        teste_expira_em: data.teste_expira_em,
        usuario: data,
        mensagem: 'Conta criada. Os 30 minutos de teste começam após entrar e contam durante o uso ativo. Um novo teste fica disponível a cada 8 horas.',
    });
};
