import { requestJson } from '../../foundation/request.js';
import { one, safeText, notify } from '../../foundation/selectors.js';

let songs = [];

function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function sectionsFromText(value) {
    const blocks = String(value || '').trim().split(/\n\s*\n+/).filter(Boolean);
    return blocks.map((block, index) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const marker = lines[0]?.match(/^\[(.+)]$/);
        const label = marker ? marker[1].trim() : String(index + 1);
        const verses = marker ? lines.slice(1) : lines;
        if (!verses.length) throw new Error(`A parte ${label} está sem versos.`);
        const type = /^coro$/i.test(label) ? 'coro'
            : /^estribilho$/i.test(label) ? 'estribilho'
                : /^parte\b/i.test(label) ? 'parte' : 'estrofe';
        return {
            tipo: type,
            rotulo: label,
            versos: verses,
        };
    });
}

function sectionsToText(sections) {
    return (sections || []).map((section, index) => {
        const label = section.rotulo
            || (section.tipo === 'coro' ? 'Coro' : section.tipo === 'estribilho' ? 'Estribilho' : index + 1);
        return `[${label}]\n${(section.versos || []).join('\n')}`;
    }).join('\n\n');
}

function totalVerses(song) {
    return (song.secoes || []).reduce((total, section) => total + (section.versos || []).length, 0);
}

function currentSong(slug) {
    return songs.find((song) => song.slug === slug);
}

function formPayload(overrides = {}) {
    return {
        original_slug: one('#adminHymnOriginalSlug').value || undefined,
        slug: one('#adminHymnSlug').value || slugify(one('#adminHymnTitle').value),
        titulo: one('#adminHymnTitle').value,
        autoria: one('#adminHymnAuthor').value,
        origem: one('#adminHymnOrigin').value,
        ordem: Number(one('#adminHymnOrder').value || 0),
        ativo: one('#adminHymnActive').checked,
        secoes: sectionsFromText(one('#adminHymnLyrics').value),
        audio: one('#adminHymnAudioUrl').value,
        ...overrides,
    };
}

function setAudioPreview(url = '') {
    const panel = one('#adminHymnAudioPreview');
    const player = one('#adminHymnAudioPlayer');
    one('#adminHymnAudioUrl').value = url || '';
    panel?.classList.toggle('hidden', !url);
    if (!player) return;
    player.pause();
    if (url) player.src = url;
    else player.removeAttribute('src');
}

function clearForm() {
    one('#adminHymnForm')?.reset();
    one('#adminHymnOriginalSlug').value = '';
    one('#adminHymnOrder').value = '0';
    one('#adminHymnActive').checked = true;
    one('#adminHymnFormTitle').textContent = 'Adicionar nova canção';
    one('#adminHymnSave').textContent = 'Salvar canção';
    one('#adminHymnStatus').textContent = '';
    setAudioPreview('');
}

function editSong(slug) {
    const song = currentSong(slug);
    if (!song) return;
    one('#adminHymnOriginalSlug').value = song.slug;
    one('#adminHymnSlug').value = song.slug;
    one('#adminHymnTitle').value = song.titulo || '';
    one('#adminHymnAuthor').value = song.autoria || '';
    one('#adminHymnOrigin').value = song.origem || '';
    one('#adminHymnOrder').value = song.ordem ?? 0;
    one('#adminHymnActive').checked = song.ativo !== false;
    one('#adminHymnLyrics').value = sectionsToText(song.secoes);
    one('#adminHymnFormTitle').textContent = `Editar — ${song.titulo}`;
    one('#adminHymnSave').textContent = 'Salvar alterações';
    setAudioPreview(song.audio || '');
    one('#adminHymnForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSongs() {
    const query = String(one('#adminHymnSearch')?.value || '').toLocaleLowerCase('pt-BR');
    const visible = songs.filter((song) => `${song.titulo} ${song.autoria || ''}`.toLocaleLowerCase('pt-BR').includes(query));
    one('#adminHymnMeta').textContent = `${visible.length} de ${songs.length} canção(ões)`;
    one('#adminHymnList').innerHTML = visible.length ? visible.map((song) => `
        <article class="admin-hymn-row ${song.ativo ? '' : 'is-inactive'}">
            <span class="admin-hymn-note" aria-hidden="true">♫</span>
            <div class="admin-hymn-row-copy">
                <strong>${safeText(song.titulo)}</strong>
                <small>${safeText(song.autoria || 'Autoria não informada')} · ${totalVerses(song)} versos · ${(song.secoes || []).length} partes · ordem ${song.ordem || 0}</small>
                <span>${song.audio ? 'Com áudio' : 'Sem áudio'} · ${song.ativo ? 'Ativa' : 'Inativa'}</span>
            </div>
            <div class="data-actions">
                <button class="ui-button quiet-action mini" data-hymn-admin="edit" data-slug="${safeText(song.slug)}" type="button">Editar</button>
                <button class="ui-button quiet-action mini" data-hymn-admin="toggle" data-slug="${safeText(song.slug)}" type="button">${song.ativo ? 'Desativar' : 'Ativar'}</button>
                <button class="ui-button quiet-action mini danger" data-hymn-admin="delete" data-slug="${safeText(song.slug)}" type="button">Excluir</button>
            </div>
        </article>
    `).join('') : '<div class="admin-empty-state">Nenhuma canção encontrada.</div>';
}

export async function refreshAdminHymns({ quiet = false } = {}) {
    try {
        const payload = await requestJson('admin-hinos');
        songs = payload.hinos || [];
        renderSongs();
        return songs;
    } catch (error) {
        one('#adminHymnMeta').textContent = 'Não foi possível carregar o acervo.';
        if (!quiet) notify(error.message, 5000);
        throw error;
    }
}

async function uploadAudio(file, slug) {
    if (!file) return one('#adminHymnAudioUrl').value;
    const prepared = await requestJson('admin-hinos', {
        method: 'POST',
        body: JSON.stringify({ acao: 'preparar-audio', slug, tipo: file.type, tamanho: file.size }),
    });
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', file);
    const response = await fetch(prepared.upload_url, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: form });
    if (!response.ok) throw new Error('Não foi possível enviar o áudio.');
    return prepared.audio_url;
}

async function saveSong(event) {
    event.preventDefault();
    const button = one('#adminHymnSave');
    const status = one('#adminHymnStatus');
    button.disabled = true;
    status.textContent = 'Salvando…';
    try {
        const payload = formPayload();
        payload.audio = await uploadAudio(one('#adminHymnAudioFile').files?.[0], payload.slug);
        const method = payload.original_slug ? 'PUT' : 'POST';
        await requestJson('admin-hinos', { method, body: JSON.stringify(payload) });
        clearForm();
        await refreshAdminHymns({ quiet: true });
        document.dispatchEvent(new Event('hymns:changed'));
        notify(method === 'POST' ? 'Canção adicionada.' : 'Canção atualizada.');
    } catch (error) {
        status.textContent = error.message;
        notify(error.message, 5000);
    } finally {
        button.disabled = false;
    }
}

async function toggleSong(song) {
    const payload = { ...song, original_slug: song.slug, ativo: !song.ativo };
    await requestJson('admin-hinos', { method: 'PUT', body: JSON.stringify(payload) });
    await refreshAdminHymns({ quiet: true });
    document.dispatchEvent(new Event('hymns:changed'));
    notify(payload.ativo ? 'Canção ativada.' : 'Canção desativada.');
}

async function deleteSong(song) {
    const confirmation = prompt(`Digite exatamente “${song.titulo}” para excluir esta canção:`);
    if (confirmation === null) return;
    await requestJson('admin-hinos', {
        method: 'DELETE',
        body: JSON.stringify({ slug: song.slug, titulo: song.titulo, confirmacao: confirmation }),
    });
    clearForm();
    await refreshAdminHymns({ quiet: true });
    document.dispatchEvent(new Event('hymns:changed'));
    notify('Canção excluída.');
}

async function importDefaults() {
    if (!confirm('Sincronizar os 17 hinos oficiais? A letra e a organização de itens com o mesmo identificador serão atualizadas.')) return;
    try {
        const response = await fetch('/assets/hinos/hinos.json', { cache: 'no-store' });
        const payload = await response.json();
        const result = await requestJson('admin-hinos', {
            method: 'POST',
            body: JSON.stringify({ acao: 'importar-padrao', hinos: payload.hinos || [] }),
        });
        await refreshAdminHymns({ quiet: true });
        document.dispatchEvent(new Event('hymns:changed'));
        notify(`${result.quantidade} hinos oficiais sincronizados.`);
    } catch (error) {
        notify(error.message, 5000);
    }
}

export function bindHymnManagement() {
    one('#adminHymnForm')?.addEventListener('submit', saveSong);
    one('#adminHymnClear')?.addEventListener('click', clearForm);
    one('#adminHymnRefresh')?.addEventListener('click', () => refreshAdminHymns());
    one('#adminHymnImportDefaults')?.addEventListener('click', importDefaults);
    one('#adminHymnSearch')?.addEventListener('input', renderSongs);
    one('#adminHymnRemoveAudio')?.addEventListener('click', () => setAudioPreview(''));
    one('#adminHymnAudioUrl')?.addEventListener('change', (event) => setAudioPreview(event.target.value));
    one('#adminHymnTitle')?.addEventListener('blur', () => {
        if (!one('#adminHymnSlug').value) one('#adminHymnSlug').value = slugify(one('#adminHymnTitle').value);
    });
    one('#adminHymnList')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-hymn-admin]');
        if (!button) return;
        const song = currentSong(button.dataset.slug);
        if (!song) return;
        try {
            if (button.dataset.hymnAdmin === 'edit') editSong(song.slug);
            if (button.dataset.hymnAdmin === 'toggle') await toggleSong(song);
            if (button.dataset.hymnAdmin === 'delete') await deleteSong(song);
        } catch (error) {
            notify(error.message, 5000);
        }
    });
}
