import { SignJWT, jwtVerify } from 'jose';
import { resolve } from 'node:path';
import { db } from './db.mjs';
import { resolveQuestionAccess } from './question-access.mjs';

const encoder = new TextEncoder();

function carregarEnvLocal() {
    if (process.env.JWT_SECRET) return;
    if (typeof process.loadEnvFile !== 'function') return;

    for (const caminho of [
        resolve(process.cwd(), '.env'),
        process.env.INIT_CWD ? resolve(process.env.INIT_CWD, '.env') : null,
        process.env.PWD ? resolve(process.env.PWD, '.env') : null,
    ].filter(Boolean)) {
        try {
            process.loadEnvFile(caminho);
            if (process.env.JWT_SECRET) return;
        } catch {
            // Continua procurando em outros caminhos locais.
        }
    }
}

const secret = () => {
    carregarEnvLocal();
    const value = process.env.JWT_SECRET;
    if (!value || value.length < 32) {
        throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
    }
    return encoder.encode(value);
};

export async function createToken(user, sessionId = null) {
    const claims = {
        nome: user.nome,
        perfil: user.perfil,
        usuario: user.usuario,
    };

    if (user.perfil === 'aluno' && sessionId) {
        claims.sessao_id = sessionId;
    }

    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime('12h')
        .sign(secret());
}

function extractToken(event) {
    const cookie = event.headers.cookie || event.headers.Cookie || '';
    return cookie
        .split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith('quiz_session='))
        ?.slice(13) || null;
}

export async function getUser(event) {
    const token = extractToken(event);
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, secret());
        const { data: registro, error } = await db()
            .from('usuarios')
            .select('*')
            .eq('id', payload.sub)
            .maybeSingle();

        if (error || !registro) return null;

        // Contas manualmente desativadas continuam impedidas de entrar. Já contas
        // marcadas por expiração de versões anteriores podem autenticar para acessar
        // perfil, histórico, ranking e contato dos ADMs; apenas as questões ficam bloqueadas.
        if (!registro.ativo && !registro.desativado_por_validade) return null;
        if (registro.status_aprovacao !== 'aprovado' && !(registro.status_aprovacao === 'pendente' && registro.acesso_teste)) return null;

        const acesso = resolveQuestionAccess(registro);
        const premiumAtivo = acesso.codigo === 'ACESSO_ATIVO';

        // O perfil atual vem do banco, evitando manter privilégios após desativação/rebaixamento.
        const user = {
            id: registro.id,
            usuario: registro.usuario,
            nome: registro.nome,
            whatsapp: registro.whatsapp || null,
            perfil: registro.perfil,
            vip: Boolean(registro.vip),
            premium: premiumAtivo,
            sessao_id: payload.sessao_id || null,
            acesso_teste: !['ACESSO_ATIVO', 'ACESSO_VITALICIO'].includes(acesso.codigo),
            teste_ativo_ate: acesso.teste_ativo_ate || null,
            teste_proximo_em: acesso.teste_proximo_em || null,
            teste_expira_em: registro.teste_expira_em || null,
            validade_ate: registro.validade_ate || null,
            acesso_questoes: Boolean(acesso.permitido),
            acesso_codigo: acesso.codigo,
            acesso_tipo: acesso.tipo,
            acesso_mensagem: acesso.mensagem,
            acesso_restante_ms: acesso.restante_ms ?? null,
        };

        // Desenvolvedor e administradores comuns nao possuem bloqueio por dispositivo.
        if (registro.perfil !== 'aluno') return user;

        // Tokens antigos, emitidos antes da protecao, deixam de autenticar alunos.
        if (!payload.sessao_id) return null;
        const { data: sessao, error: sessionError } = await db()
            .from('sessoes_dispositivo')
            .select('id,expira_em')
            .eq('id', payload.sessao_id)
            .eq('usuario_id', registro.id)
            .maybeSingle();
        if (sessionError || !sessao) return null;

        const expiraEm = sessao.expira_em ? new Date(sessao.expira_em).getTime() : 0;

        if (!expiraEm || expiraEm <= Date.now()) return null;

        return user;
    } catch {
        return null;
    }
}

export async function requireUser(event, role) {
    const user = await getUser(event);
    if (!user) return null;

    if (!role) return user;

    const allowedRoles = Array.isArray(role) ? role : [role];
    return allowedRoles.includes(user.perfil) ? user : null;
}

export const sessionCookie = (token) =>
    `quiz_session=${token}; Path=/; HttpOnly; ${
        process.env.VERCEL_ENV === 'development' || process.env.NODE_ENV === 'development'
            ? ''
            : 'Secure; '
    }SameSite=Lax; Max-Age=43200`;

export const clearCookie =
    `quiz_session=; Path=/; HttpOnly; ${
        process.env.VERCEL_ENV === 'development' || process.env.NODE_ENV === 'development'
            ? ''
            : 'Secure; '
    }SameSite=Lax; Max-Age=0`;
