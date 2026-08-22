import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../lib/db.mjs';
import { createToken, sessionCookie } from '../lib/auth.mjs';
import { json, parseBody } from '../lib/http.mjs';
import { consumeRateLimit } from '../lib/rate-limit.mjs';

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

        const rate = await consumeRateLimit(event, 'login', { limit: 10, windowSeconds: 15 * 60 }, login);
        if (!rate.allowed) {
            return json(429, { erro: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.' }, { 'retry-after': '900' });
        }

        if (!login || !senha) {
            return json(400, { erro: 'Informe o AL SD PM Nº e a senha.' });
        }

        const { data: user, error } = await db()
            .from('usuarios')
            .select('*')
            .eq('usuario', login)
            .maybeSingle();

        if (error || !user || !(await bcrypt.compare(String(senha), user.senha_hash))) {
            return json(401, { erro: 'AL SD PM Nº ou senha inválidos.' });
        }

        if (user.status_aprovacao === 'pendente') {
            return json(403, { erro: 'Cadastro aguardando aprovação de um administrador.' });
        }

        if (user.status_aprovacao === 'negado') {
            return json(403, { erro: 'Cadastro não aprovado. Procure um administrador.' });
        }

        if (!user.ativo) {
            return json(403, { erro: 'Conta desativada. Procure um administrador.' });
        }

        // Somente alunos ficam limitados a uma sessao simultanea.
        if (user.perfil === 'aluno') {
            sessionId = randomUUID();
            alunoId = user.id;
            const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

            const { data: sessionCreated, error: sessionError } = await db().rpc(
                'iniciar_sessao_exclusiva_aluno',
                {
                    p_usuario_id: user.id,
                    p_sessao_id: sessionId,
                    p_expira_em: expiresAt,
                },
            );

            if (sessionError) throw sessionError;

            if (!sessionCreated) {
                return json(409, {
                    erro: 'Esta conta já está conectada em outro dispositivo. Faça logout no outro aparelho ou aguarde a sessão expirar.',
                    codigo: 'SESSAO_JA_ATIVA',
                });
            }
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
                },
            },
            { 'set-cookie': sessionCookie(token) },
        );
    } catch (error) {
        // Se a emissao do token falhar depois de reservar a sessao, libera o aluno.
        if (alunoId && sessionId) {
            try {
                await db()
                    .from('usuarios')
                    .update({ sessao_ativa_id: null, sessao_ativa_expira_em: null })
                    .eq('id', alunoId)
                    .eq('sessao_ativa_id', sessionId);
            } catch {
                // Mantem o erro original.
            }
        }

        return json(500, { erro: error.message });
    }
};
