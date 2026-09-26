import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { auditAdmin } from '../platform/admin-audit.mjs';
import { json, parseBody } from '../platform/http.mjs';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const BUCKET = 'resumos-pdf';
const MAX_PDF_SIZE = 30 * 1024 * 1024;

function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function summaryPayload(body) {
    const titulo = String(body.titulo || '').trim().slice(0, 160);
    const disciplina = String(body.disciplina || '').trim().slice(0, 160);
    const slug = slugify(body.slug || titulo);
    const arquivo = String(body.arquivo || '').trim().slice(0, 1200);
    if (!titulo || !disciplina || !slug) throw new Error('Informe título e disciplina.');
    if (!arquivo || !/^[a-z0-9-]+-\d+\.pdf$/i.test(arquivo)) throw new Error('Envie o arquivo PDF pelo painel.');
    return {
        slug,
        titulo,
        disciplina,
        descricao: String(body.descricao || '').trim().slice(0, 240) || null,
        arquivo,
        ordem: Number.isFinite(Number(body.ordem)) ? Number(body.ordem) : 0,
        ativo: body.ativo !== false,
        atualizado_em: new Date().toISOString(),
    };
}

function storagePath(url) {
    const path = String(url || '').trim();
    return /^[a-z0-9-]+-\d+\.pdf$/i.test(path) ? path : null;
}

async function removeStoredFile(url) {
    const path = storagePath(url);
    if (!path) return;
    const removal = await db().storage.from(BUCKET).remove([path]);
    if (removal.error) console.error('Falha ao remover PDF:', removal.error.message);
}

async function listSummaries() {
    const { data, error } = await db().from('resumos').select('*').order('ordem').order('disciplina').order('titulo');
    if (error) throw error;
    return data || [];
}

export const handler = async (event) => {
    const actor = await requireUser(event, 'supremo');
    if (!actor) return json(403, { erro: 'Acesso permitido somente ao Desenvolvedor.' });
    const body = parseBody(event);

    try {
        if (event.httpMethod === 'GET') return json(200, { resumos: await listSummaries() });

        if (event.httpMethod === 'POST' && body.acao === 'preparar-pdf') {
            const size = Number(body.tamanho || 0);
            const type = String(body.tipo || '').toLowerCase();
            if (type !== 'application/pdf' || size <= 0 || size > MAX_PDF_SIZE) {
                return json(400, { erro: 'Use um arquivo PDF de até 30 MB.' });
            }
            const path = `${slugify(body.slug) || 'resumo'}-${Date.now()}.pdf`;
            const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
            if (error) throw error;
            return json(200, { caminho: path, upload_url: data.signedUrl });
        }

        if (event.httpMethod === 'POST' && body.acao === 'finalizar-pdf') {
            const path = storagePath(body.caminho);
            if (!path) return json(400, { erro: 'Arquivo PDF inválido.' });
            const downloaded = await db().storage.from(BUCKET).download(path);
            if (downloaded.error || !downloaded.data) throw downloaded.error || new Error('PDF não encontrado.');
            try {
                const input = new Uint8Array(await downloaded.data.arrayBuffer());
                const document = await PDFDocument.load(input, { ignoreEncryption: false });
                const font = await document.embedFont(StandardFonts.HelveticaBold);
                const watermark = 'QUESTIONARIO BIZU - MATERIAL EXCLUSIVO PARA ASSINANTES';
                for (const page of document.getPages()) {
                    const { width, height } = page.getSize();
                    const size = Math.max(18, Math.min(38, width / 17));
                    const textWidth = font.widthOfTextAtSize(watermark, size);
                    page.drawText(watermark, {
                        x: (width - textWidth * 0.72) / 2,
                        y: height * 0.48,
                        size,
                        font,
                        color: rgb(0.08, 0.18, 0.34),
                        opacity: 0.13,
                        rotate: degrees(32),
                    });
                    page.drawText('QUESTIONARIO BIZU', {
                        x: 24,
                        y: 14,
                        size: 7,
                        font,
                        color: rgb(0.08, 0.18, 0.34),
                        opacity: 0.42,
                    });
                }
                const bytes = await document.save({ useObjectStreams: true });
                const replaced = await db().storage.from(BUCKET).update(path, Buffer.from(bytes), {
                    contentType: 'application/pdf',
                    cacheControl: '0',
                    upsert: true,
                });
                if (replaced.error) throw replaced.error;
                return json(200, { ok: true, caminho: path });
            } catch (error) {
                await removeStoredFile(path);
                throw new Error(`Não foi possível aplicar a marca d’água: ${error.message}`);
            }
        }

        if (event.httpMethod === 'POST') {
            const item = summaryPayload(body);
            const { data, error } = await db().from('resumos').insert(item).select().single();
            if (error) return json(400, { erro: error.code === '23505' ? 'Já existe um resumo com esse identificador.' : 'Não foi possível adicionar o resumo.' });
            await auditAdmin(actor, 'resumo_criar', 'resumo', item.slug, { titulo: item.titulo, disciplina: item.disciplina });
            return json(201, { item: data });
        }

        if (event.httpMethod === 'PUT') {
            const originalSlug = slugify(body.original_slug || body.slug);
            const item = summaryPayload(body);
            const previous = await db().from('resumos').select('arquivo').eq('slug', originalSlug).maybeSingle();
            if (previous.error) throw previous.error;
            const { data, error } = await db().from('resumos').update(item).eq('slug', originalSlug).select().maybeSingle();
            if (error) throw error;
            if (!data) return json(404, { erro: 'Resumo não encontrado.' });
            if (previous.data?.arquivo && previous.data.arquivo !== item.arquivo) await removeStoredFile(previous.data.arquivo);
            await auditAdmin(actor, 'resumo_editar', 'resumo', originalSlug, { novo_slug: item.slug });
            return json(200, { item: data });
        }

        if (event.httpMethod === 'DELETE') {
            const slug = slugify(body.slug);
            if (!slug || String(body.confirmacao || '').trim() !== String(body.titulo || '').trim()) {
                return json(400, { erro: 'Digite exatamente o título do resumo para confirmar a exclusão.' });
            }
            const { data, error } = await db().from('resumos').delete().eq('slug', slug).select('slug,titulo,arquivo').maybeSingle();
            if (error) throw error;
            if (!data) return json(404, { erro: 'Resumo não encontrado.' });
            await removeStoredFile(data.arquivo);
            await auditAdmin(actor, 'resumo_excluir', 'resumo', slug, { titulo: data.titulo });
            return json(200, { ok: true });
        }
    } catch (error) {
        console.error('Falha na administração de resumos:', error.message);
        return json(400, { erro: error.message || 'Não foi possível concluir a operação.' });
    }

    return json(405, { erro: 'Método não permitido.' });
};
