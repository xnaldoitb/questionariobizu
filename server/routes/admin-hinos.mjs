import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { auditAdmin } from '../platform/admin-audit.mjs';
import { json, parseBody } from '../platform/http.mjs';

const BUCKET = 'hinos-audio';
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-wav']);
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;

function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function normalizedSections(value) {
    if (!Array.isArray(value) || !value.length) throw new Error('Informe ao menos uma parte da letra.');
    return value.map((section, index) => {
        const versos = Array.isArray(section?.versos)
            ? section.versos.map((verse) => String(verse || '').trim()).filter(Boolean)
            : [];
        if (!versos.length) throw new Error(`A parte ${index + 1} está sem versos.`);
        return {
            tipo: section?.tipo === 'coro' ? 'coro' : 'estrofe',
            rotulo: String(section?.rotulo || index + 1).trim().slice(0, 40),
            versos,
        };
    });
}

function songPayload(body) {
    const titulo = String(body.titulo || '').trim().slice(0, 160);
    const slug = slugify(body.slug || titulo);
    if (!titulo || !slug) throw new Error('Informe o título da canção.');
    return {
        slug,
        titulo,
        autoria: String(body.autoria || '').trim().slice(0, 200) || null,
        origem: String(body.origem || '').trim().slice(0, 240) || null,
        secoes: normalizedSections(body.secoes),
        audio: String(body.audio || '').trim().slice(0, 1000) || null,
        ordem: Number.isFinite(Number(body.ordem)) ? Number(body.ordem) : 0,
        ativo: body.ativo !== false,
        atualizado_em: new Date().toISOString(),
    };
}

async function listSongs() {
    const { data, error } = await db().from('hinos').select('*').order('ordem').order('titulo');
    if (error) throw error;
    return data || [];
}

export const handler = async (event) => {
    const actor = await requireUser(event, 'supremo');
    if (!actor) return json(403, { erro: 'Acesso permitido somente ao Desenvolvedor.' });
    const body = parseBody(event);

    try {
        if (event.httpMethod === 'GET') return json(200, { hinos: await listSongs() });

        if (event.httpMethod === 'POST' && body.acao === 'preparar-audio') {
            const type = String(body.tipo || '').toLowerCase();
            const size = Number(body.tamanho || 0);
            if (!AUDIO_TYPES.has(type) || size <= 0 || size > MAX_AUDIO_SIZE) {
                return json(400, { erro: 'Use um áudio MP3, MP4, OGG ou WAV de até 20 MB.' });
            }
            const extension = type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : type.includes('mp4') ? 'm4a' : 'mp3';
            const path = `${slugify(body.slug) || 'cancao'}-${Date.now()}.${extension}`;
            const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
            if (error) throw error;
            const publicUrl = db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
            return json(200, { caminho: path, upload_url: data.signedUrl, audio_url: publicUrl });
        }

        if (event.httpMethod === 'POST' && body.acao === 'importar-padrao') {
            const songs = Array.isArray(body.hinos) ? body.hinos.slice(0, 100).map(songPayload) : [];
            if (!songs.length) return json(400, { erro: 'Nenhuma canção válida para importar.' });
            const { error } = await db().from('hinos').upsert(songs, { onConflict: 'slug' });
            if (error) throw error;
            await auditAdmin(actor, 'hinos_importar', 'hinos', null, { quantidade: songs.length });
            return json(200, { ok: true, quantidade: songs.length });
        }

        if (event.httpMethod === 'POST') {
            const song = songPayload(body);
            const { data, error } = await db().from('hinos').insert(song).select().single();
            if (error) return json(400, { erro: error.code === '23505' ? 'Já existe uma canção com esse identificador.' : 'Não foi possível adicionar a canção.' });
            await auditAdmin(actor, 'hino_criar', 'hino', song.slug, { titulo: song.titulo });
            return json(201, { item: data });
        }

        if (event.httpMethod === 'PUT') {
            const originalSlug = slugify(body.original_slug || body.slug);
            const song = songPayload(body);
            const previous = await db().from('hinos').select('audio').eq('slug', originalSlug).maybeSingle();
            if (previous.error) throw previous.error;
            const { data, error } = await db().from('hinos').update(song).eq('slug', originalSlug).select().maybeSingle();
            if (error) throw error;
            if (!data) return json(404, { erro: 'Canção não encontrada.' });
            const marker = `/storage/v1/object/public/${BUCKET}/`;
            if (previous.data?.audio && previous.data.audio !== song.audio && previous.data.audio.includes(marker)) {
                const path = decodeURIComponent(previous.data.audio.split(marker)[1].split('?')[0]);
                const removal = await db().storage.from(BUCKET).remove([path]);
                if (removal.error) console.error('Falha ao remover áudio substituído:', removal.error.message);
            }
            await auditAdmin(actor, 'hino_editar', 'hino', originalSlug, { novo_slug: song.slug });
            return json(200, { item: data });
        }

        if (event.httpMethod === 'DELETE') {
            const slug = slugify(body.slug);
            if (!slug || String(body.confirmacao || '').trim() !== String(body.titulo || '').trim()) {
                return json(400, { erro: 'Digite exatamente o título da canção para confirmar a exclusão.' });
            }
            const { data, error } = await db().from('hinos').delete().eq('slug', slug).select('slug,titulo,audio').maybeSingle();
            if (error) throw error;
            if (!data) return json(404, { erro: 'Canção não encontrada.' });
            const marker = `/storage/v1/object/public/${BUCKET}/`;
            if (data.audio?.includes(marker)) {
                const path = decodeURIComponent(data.audio.split(marker)[1].split('?')[0]);
                const removal = await db().storage.from(BUCKET).remove([path]);
                if (removal.error) console.error('Falha ao remover áudio antigo:', removal.error.message);
            }
            await auditAdmin(actor, 'hino_excluir', 'hino', slug, { titulo: data.titulo });
            return json(200, { ok: true });
        }
    } catch (error) {
        console.error('Falha na administração de hinos:', error.message);
        return json(400, { erro: error.message || 'Não foi possível concluir a operação.' });
    }

    return json(405, { erro: 'Método não permitido.' });
};
