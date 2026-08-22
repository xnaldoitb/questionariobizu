import { SignJWT, jwtVerify } from 'jose';
import { resolve } from 'node:path';
import { db } from './db.mjs';
import { expireUserAccess, isAccessExpired } from './access-validity.mjs';

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

        // Uma desativação manual permanece soberana e não é convertida em
        // desativação por validade apenas porque a data também venceu.
        if (!registro.ativo && !registro.desativado_por_validade) return null;

        // A validade é conferida em toda requisição autenticada. Assim, uma sessão
        // que esteja aberta também perde acesso quando o prazo termina.
        if (registro.perfil !== 'supremo' && !registro.vip && isAccessExpired(registro.validade_ate)) {
            await expireUserAccess(registro.id);
            return null;
        }

        if (!registro.ativo || registro.status_aprovacao !== 'aprovado') return null;

        // O perfil atual vem do banco, evitando manter privilegios apos desativacao/rebaixamento.
        const user = {
            id: registro.id,
            usuario: registro.usuario,
            nome: registro.nome,
            perfil: registro.perfil,
            vip: Boolean(registro.vip),
            sessao_id: payload.sessao_id || null,
        };

        // ADM Supremo e administradores comuns nao possuem bloqueio por dispositivo.
        if (registro.perfil !== 'aluno') return user;

        // Tokens antigos, emitidos antes da protecao, deixam de autenticar alunos.
        if (!payload.sessao_id) return null;
        if (!registro.sessao_ativa_id || registro.sessao_ativa_id !== payload.sessao_id) return null;

        const expiraEm = registro.sessao_ativa_expira_em
            ? new Date(registro.sessao_ativa_expira_em).getTime()
            : 0;

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
