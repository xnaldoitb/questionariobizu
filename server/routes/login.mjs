import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '../platform/db.mjs';
import { createToken, sessionCookie } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { resolveQuestionAccess } from '../platform/question-access.mjs';

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return json(405, { erro: 'Método não permitido.' });
    }

    let sessionId = null;
    let alunoId = null;

    try {
        const { usuario = '', senha = '' } = parseBody(event);
        const login = String(usuario).trim().toLowerCase();
        const deviceToken = String(event.headers?.['x-client-device'] || event.headers?.['X-Client-Device'] || '').trim();
        const deviceHash = /^[a-zA-Z0-9-]{20,100}$/.test(deviceToken)
            ? createHash('sha256').update(deviceToken).digest('hex')
            : null;

        const rates = await Promise.all([
            consumeRateLimit(event, 'login-ip', { limit: 30, windowSeconds: 15 * 60, failClosed: true }),
            consumeRateLimit(event, 'login-conta', { limit: 10, windowSeconds: 15 * 60, failClosed: true }, login),
        ]);
        if (rates.some((rate) => !rate.allowed)) {
            if (rates.some((rate) => rate.unavailable)) {
                return json(503, { erro: 'A proteção de acesso está temporariamente indisponível. Tente novamente em alguns minutos.' });
            }
            return json(429, { erro: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' }, { 'retry-after': '900' });
        }

        if (!login || !senha) {
            return json(400, { erro: 'Informe o AL SD PM Nº e a senha.' });
        }

        if (!deviceHash) {
            return json(400, { erro: 'Não foi possível identificar este dispositivo. Atualize a página e tente novamente.' });
        }

        const { data: user, error } = await db()
            .from('usuarios')
            .select('*')
            .eq('usuario', login)
            .maybeSingle();

        if (error || !user || !(await bcrypt.compare(String(senha), user.senha_hash))) {
            return json(401, { erro: 'AL SD PM Nº ou senha inválidos.' });
        }

        if (user.status_aprovacao === 'pendente' && !user.acesso_teste) {
            return json(403, { erro: 'Cadastro aguardando aprovação de um administrador.' });
        }

        if (user.status_aprovacao === 'negado') {
            return json(403, { erro: 'Cadastro não aprovado. Procure um administrador.' });
        }

        // Expiração não impede mais o login. O usuário continua entrando para
        // consultar perfil, histórico, ranking e contato dos ADMs. Apenas uma
        // desativação manual continua bloqueando a conta por completo.
        if (!user.ativo && !user.desativado_por_validade) {
            return json(403, { erro: 'Conta desativada. Procure um administrador.' });
        }

        const acesso = resolveQuestionAccess(user);

        // Somente alunos ficam limitados a duas sessoes simultaneas.
        if (user.perfil === 'aluno') {
            const requestedSessionId = randomUUID();
            alunoId = user.id;
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

            const { data: sessionResult, error: sessionError } = await db().rpc(
                'iniciar_sessao_dispositivo_aluno',
                {
                    p_usuario_id: user.id,
                    p_sessao_id: requestedSessionId,
                    p_expira_em: expiresAt,
                    p_device_hash: deviceHash,
                    p_limite: 2,
                },
            );

            if (sessionError) throw sessionError;
            const reservation = Array.isArray(sessionResult) ? sessionResult[0] : sessionResult;

            if (!reservation?.permitido || !reservation?.sessao_id) {
                return json(409, {
                    erro: 'Esta conta já está conectada em dois dispositivos. Faça logout em um deles ou peça ao suporte para encerrar as sessões.',
                    codigo: 'LIMITE_DISPOSITIVOS',
                });
            }
            sessionId = reservation.sessao_id;
        }

        const token = await createToken(user, sessionId);

        await db()
            .from('usuarios')
            .update({ ultimo_acesso: new Date().toISOString() })
            .eq('id', user.id);

        return json(
            200,
            {
                usuario: {
                    id: user.id,
                    usuario: user.usuario,
                    nome: user.nome,
                    perfil: user.perfil,
                    status_aprovacao: user.status_aprovacao,
                    vip: Boolean(user.vip),
                    premium: acesso.codigo === 'ACESSO_ATIVO',
                    acesso_teste: !['ACESSO_ATIVO', 'ACESSO_VITALICIO'].includes(acesso.codigo),
                    teste_ativo_ate: acesso.teste_ativo_ate || null,
                    teste_proximo_em: acesso.teste_proximo_em || null,
                    teste_expira_em: user.teste_expira_em || null,
                    validade_ate: user.validade_ate || null,
                    acesso_questoes: Boolean(acesso.permitido),
                    acesso_codigo: acesso.codigo,
                    acesso_tipo: acesso.tipo,
                    acesso_mensagem: acesso.mensagem,
                    acesso_restante_ms: acesso.restante_ms ?? null,
                },
            },
            { 'set-cookie': sessionCookie(token) },
        );
    } catch (error) {
        // Se a emissao do token falhar depois de reservar a sessao, libera o aluno.
        if (alunoId && sessionId) {
            try {
                await db().from('sessoes_dispositivo').delete().eq('usuario_id', alunoId).eq('id', sessionId);
            } catch {
                // Mantem o erro original.
            }
        }

        console.error('Falha interna no login:', error.message);
        return json(500, { erro: 'Não foi possível entrar agora. Tente novamente em alguns minutos.' });
    }
};
