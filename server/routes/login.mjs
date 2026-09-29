import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '../platform/db.mjs';
import { createToken, sessionCookie } from '../platform/auth.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { consumeRateLimit, rateLimitKey } from '../platform/rate-limit.mjs';
import { resolveQuestionAccess } from '../platform/question-access.mjs';

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const RATE_LIMIT_TIMEOUT_MS = 12000;
const DATABASE_TIMEOUT_MS = 12000;
const LOGIN_COLUMNS = [
    'id', 'usuario', 'nome', 'senha_hash', 'perfil', 'status_aprovacao', 'ativo',
    'desativado_por_validade', 'vip', 'premium', 'plano_atual', 'validade_ate', 'colaborador', 'colaborador_desde',
    'acesso_teste', 'teste_expira_em', 'teste_ciclo_em', 'teste_saldo_segundos',
    'teste_ativo_ate',
].join(',');

function within(promise, milliseconds, publicMessage) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error(publicMessage);
            error.publicMessage = publicMessage;
            reject(error);
        }, milliseconds);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function consumeLoginLimits(event, login) {
    const client = db();
    const optimized = typeof client.rpc === 'function'
        ? await client.rpc('consume_login_limits_v4566', {
            p_ip_key: rateLimitKey('', true, event),
            p_account_key: rateLimitKey(login, false, event),
        })
        : { data: null, error: { code: 'PGRST202' } };
    if (!optimized.error) {
        const value = optimized.data || {};
        return [
            { allowed: value.ip_allowed !== false, unavailable: false },
            { allowed: value.account_allowed !== false, unavailable: false },
        ];
    }
    if (!['42883', 'PGRST202'].includes(optimized.error.code)) {
        return [{ allowed: false, unavailable: true }];
    }
    return Promise.all([
        consumeRateLimit(event, 'login-ip', { limit: 30, windowSeconds: 15 * 60, failClosed: true }),
        consumeRateLimit(event, 'login-conta', {
            limit: 50, windowSeconds: 15 * 60, failClosed: true, includeIp: false,
        }, login),
    ]);
}

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

        if (!login || !senha) {
            return json(400, { erro: 'Informe o AL SD PM Nº e a senha.' });
        }

        if (!deviceHash) {
            return json(400, { erro: 'Não foi possível identificar este dispositivo. Atualize a página e tente novamente.' });
        }

        const userLookup = within(db()
            .from('usuarios')
            .select(LOGIN_COLUMNS)
            .eq('usuario', login)
            .maybeSingle(), DATABASE_TIMEOUT_MS, 'O servidor demorou para localizar seu cadastro. Tente novamente.');
        const ratesLookup = within(
            consumeLoginLimits(event, login),
            RATE_LIMIT_TIMEOUT_MS,
            'A proteção de acesso demorou para responder. Tente novamente.',
        );
        const [rates, { data: user, error }] = await Promise.all([ratesLookup, userLookup]);

        if (rates.some((rate) => !rate.allowed)) {
            if (rates.some((rate) => rate.unavailable)) {
                return json(503, { erro: 'A proteção de acesso está temporariamente indisponível. Tente novamente em alguns minutos.' });
            }
            return json(429, { erro: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' }, { 'retry-after': '900' });
        }

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
        const lastAccessUpdate = within(
            db().from('usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('id', user.id),
            DATABASE_TIMEOUT_MS,
            'A atualização do acesso demorou para responder.',
        ).catch((error) => {
            console.error('Falha ao atualizar o último acesso:', error.message);
        });

        // Somente alunos ficam limitados a duas sessoes simultaneas.
        if (user.perfil === 'aluno') {
            const requestedSessionId = randomUUID();
            alunoId = user.id;
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

            const { data: sessionResult, error: sessionError } = await within(db().rpc(
                'iniciar_sessao_dispositivo_aluno',
                {
                    p_usuario_id: user.id,
                    p_sessao_id: requestedSessionId,
                    p_expira_em: expiresAt,
                    p_device_hash: deviceHash,
                    p_limite: 2,
                },
            ), DATABASE_TIMEOUT_MS, 'O servidor demorou para liberar o acesso neste dispositivo. Tente novamente.');

            if (sessionError) throw sessionError;
            const reservation = Array.isArray(sessionResult) ? sessionResult[0] : sessionResult;

            if (!reservation?.permitido || !reservation?.sessao_id) {
                return json(409, {
                    erro: 'Não foi possível liberar uma vaga de acesso. Tente novamente ou procure o suporte.',
                    codigo: 'LIMITE_DISPOSITIVOS',
                });
            }
            sessionId = reservation.sessao_id;
        }

        const token = await createToken(user, sessionId);
        // A atualização começou em paralelo à reserva do dispositivo. Uma
        // falha neste registro auxiliar não invalida uma autenticação correta.
        await lastAccessUpdate;

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
                    plano_atual: user.plano_atual || null,
                    colaborador: Boolean(user.colaborador),
                    colaborador_desde: user.colaborador_desde || null,
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
        return json(500, { erro: error.publicMessage || 'Não foi possível entrar agora. Tente novamente em alguns minutos.' });
    }
};
