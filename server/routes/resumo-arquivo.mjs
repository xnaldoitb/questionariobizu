import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';

const BUCKET = 'resumos-pdf';
const PAID_ACCESS = new Set(['ACESSO_ATIVO', 'ACESSO_VITALICIO']);

function safeSlug(value) {
    const slug = String(value || '').trim().toLowerCase();
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

function allowed(user) {
    return ['admin', 'supremo'].includes(user?.perfil) || PAID_ACCESS.has(user?.acesso_codigo);
}

export async function streamHandler(req, res, event) {
    if (event.httpMethod !== 'GET') return res.status(405).json({ erro: 'Método não permitido.' });
    const user = await requireUser(event);
    if (!user) return res.status(401).json({ erro: 'Faça login para acessar este PDF.' });
    if (!allowed(user)) return res.status(403).json({ erro: 'Este material é exclusivo para assinantes com acesso ativo.' });

    const slug = safeSlug(event.queryStringParameters?.slug);
    if (!slug) return res.status(400).json({ erro: 'Resumo inválido.' });
    const { data: item, error } = await db().from('resumos').select('titulo,arquivo,ativo').eq('slug', slug).maybeSingle();
    if (error) return res.status(503).json({ erro: 'Não foi possível consultar o resumo.' });
    if (!item || (!item.ativo && user.perfil === 'aluno')) return res.status(404).json({ erro: 'Resumo não encontrado.' });

    const path = String(item.arquivo || '');
    if (!/^[a-z0-9-]+-\d+\.pdf$/i.test(path)) return res.status(404).json({ erro: 'Arquivo não encontrado.' });
    const downloaded = await db().storage.from(BUCKET).download(path);
    if (downloaded.error || !downloaded.data) return res.status(404).json({ erro: 'Arquivo não encontrado.' });

    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    const filename = `${slug}.pdf`;
    res.statusCode = 200;
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-length', String(bytes.length));
    res.setHeader('content-disposition', `inline; filename="${filename}"`);
    res.setHeader('cache-control', 'private, no-store, max-age=0');
    res.setHeader('pragma', 'no-cache');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('cross-origin-resource-policy', 'same-origin');
    const chunkSize = 64 * 1024;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        res.write(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    res.end();
}
