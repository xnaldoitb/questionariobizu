import { requestJson } from '../../foundation/request.js';
import { one, safeText, notify } from '../../foundation/selectors.js';

let summaries = [];

function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function currentSummary(slug) {
    return summaries.find((item) => item.slug === slug);
}

function setFile(url = '') {
    one('#adminSummaryCurrentFile').value = url;
    const preview = one('#adminSummaryFilePreview');
    const link = one('#adminSummaryFileLink');
    preview?.classList.toggle('hidden', !url);
    if (link) {
        const slug = one('#adminSummaryOriginalSlug').value || one('#adminSummarySlug').value;
        link.href = url && slug ? `/api/resumo-arquivo?slug=${encodeURIComponent(slug)}` : '#';
    }
}

function clearForm() {
    one('#adminSummaryForm')?.reset();
    one('#adminSummaryOriginalSlug').value = '';
    one('#adminSummaryOrder').value = '0';
    one('#adminSummaryActive').checked = true;
    one('#adminSummaryFormTitle').textContent = 'Adicionar novo resumo';
    one('#adminSummarySave').textContent = 'Salvar resumo';
    one('#adminSummaryStatus').textContent = '';
    setFile('');
}

function formPayload() {
    return {
        original_slug: one('#adminSummaryOriginalSlug').value || undefined,
        slug: one('#adminSummarySlug').value || slugify(one('#adminSummaryTitle').value),
        titulo: one('#adminSummaryTitle').value,
        disciplina: one('#adminSummaryDiscipline').value,
        descricao: one('#adminSummaryDescription').value,
        ordem: Number(one('#adminSummaryOrder').value || 0),
        ativo: one('#adminSummaryActive').checked,
        arquivo: one('#adminSummaryCurrentFile').value,
    };
}

function editSummary(slug) {
    const item = currentSummary(slug);
    if (!item) return;
    one('#adminSummaryOriginalSlug').value = item.slug;
    one('#adminSummarySlug').value = item.slug;
    one('#adminSummaryTitle').value = item.titulo || '';
    one('#adminSummaryDiscipline').value = item.disciplina || '';
    one('#adminSummaryDescription').value = item.descricao || '';
    one('#adminSummaryOrder').value = item.ordem ?? 0;
    one('#adminSummaryActive').checked = item.ativo !== false;
    one('#adminSummaryFormTitle').textContent = `Editar — ${item.titulo}`;
    one('#adminSummarySave').textContent = 'Salvar alterações';
    setFile(item.arquivo || '');
    one('#adminSummaryForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSummaries() {
    const query = String(one('#adminSummarySearch')?.value || '').toLocaleLowerCase('pt-BR');
    const visible = summaries.filter((item) => `${item.titulo} ${item.disciplina}`.toLocaleLowerCase('pt-BR').includes(query));
    one('#adminSummaryMeta').textContent = `${visible.length} de ${summaries.length} resumo(s)`;
    one('#adminSummaryList').innerHTML = visible.length ? visible.map((item) => `
        <article class="admin-hymn-row ${item.ativo ? '' : 'is-inactive'}">
            <span class="admin-summary-row-icon" aria-hidden="true">PDF</span>
            <div class="admin-hymn-row-copy">
                <strong>${safeText(item.titulo)}</strong>
                <small>${safeText(item.disciplina)} · ordem ${item.ordem || 0}</small>
                <span>${item.arquivo ? 'Com PDF' : 'Sem PDF'} · ${item.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div class="data-actions">
                ${item.arquivo ? `<a class="ui-button quiet-action mini" href="/api/resumo-arquivo?slug=${encodeURIComponent(item.slug)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}
                <button class="ui-button quiet-action mini" data-summary-admin="edit" data-slug="${safeText(item.slug)}" type="button">Editar</button>
                <button class="ui-button quiet-action mini" data-summary-admin="toggle" data-slug="${safeText(item.slug)}" type="button">${item.ativo ? 'Desativar' : 'Ativar'}</button>
                <button class="ui-button quiet-action mini danger" data-summary-admin="delete" data-slug="${safeText(item.slug)}" type="button">Excluir</button>
            </div>
        </article>
    `).join('') : '<div class="admin-empty-state">Nenhum resumo encontrado.</div>';
}

export async function refreshAdminSummaries({ quiet = false } = {}) {
    try {
        const payload = await requestJson('admin-resumos');
        summaries = payload.resumos || [];
        renderSummaries();
        return summaries;
    } catch (error) {
        one('#adminSummaryMeta').textContent = 'Não foi possível carregar os resumos.';
        if (!quiet) notify(error.message, 5000);
        throw error;
    }
}

async function uploadPdf(file, slug) {
    if (!file) return one('#adminSummaryCurrentFile').value;
    const prepared = await requestJson('admin-resumos', {
        method: 'POST',
        body: JSON.stringify({ acao: 'preparar-pdf', slug, tipo: file.type || 'application/pdf', tamanho: file.size }),
    });
    const response = await fetch(prepared.upload_url, {
        method: 'PUT',
        headers: { 'content-type': 'application/pdf', 'x-upsert': 'false' },
        body: file,
    });
    if (!response.ok) throw new Error('Não foi possível enviar o PDF.');
    const finalized = await requestJson('admin-resumos', {
        method: 'POST',
        body: JSON.stringify({ acao: 'finalizar-pdf', caminho: prepared.caminho }),
    });
    return finalized.caminho;
}

async function saveSummary(event) {
    event.preventDefault();
    const button = one('#adminSummarySave');
    const status = one('#adminSummaryStatus');
    button.disabled = true;
    status.textContent = 'Salvando…';
    try {
        const payload = formPayload();
        payload.arquivo = await uploadPdf(one('#adminSummaryFile').files?.[0], payload.slug);
        if (!payload.arquivo) throw new Error('Envie ou informe o endereço do arquivo PDF.');
        const method = payload.original_slug ? 'PUT' : 'POST';
        await requestJson('admin-resumos', { method, body: JSON.stringify(payload) });
        clearForm();
        await refreshAdminSummaries({ quiet: true });
        document.dispatchEvent(new Event('summaries:changed'));
        notify(method === 'POST' ? 'Resumo adicionado.' : 'Resumo atualizado.');
    } catch (error) {
        status.textContent = error.message;
        notify(error.message, 5000);
    } finally {
        button.disabled = false;
    }
}

async function toggleSummary(item) {
    await requestJson('admin-resumos', { method: 'PUT', body: JSON.stringify({ ...item, original_slug: item.slug, ativo: !item.ativo }) });
    await refreshAdminSummaries({ quiet: true });
    document.dispatchEvent(new Event('summaries:changed'));
    notify(item.ativo ? 'Resumo desativado.' : 'Resumo ativado.');
}

async function deleteSummary(item) {
    const confirmation = prompt(`Digite exatamente “${item.titulo}” para excluir este resumo:`);
    if (confirmation === null) return;
    await requestJson('admin-resumos', { method: 'DELETE', body: JSON.stringify({ slug: item.slug, titulo: item.titulo, confirmacao: confirmation }) });
    clearForm();
    await refreshAdminSummaries({ quiet: true });
    document.dispatchEvent(new Event('summaries:changed'));
    notify('Resumo excluído.');
}

export function bindSummaryManagement() {
    one('#adminSummaryForm')?.addEventListener('submit', saveSummary);
    one('#adminSummaryClear')?.addEventListener('click', clearForm);
    one('#adminSummaryRefresh')?.addEventListener('click', () => refreshAdminSummaries());
    one('#adminSummarySearch')?.addEventListener('input', renderSummaries);
    one('#adminSummaryRemoveFile')?.addEventListener('click', () => setFile(''));
    one('#adminSummaryTitle')?.addEventListener('blur', () => {
        if (!one('#adminSummarySlug').value) one('#adminSummarySlug').value = slugify(one('#adminSummaryTitle').value);
    });
    one('#adminSummaryList')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-summary-admin]');
        if (!button) return;
        const item = currentSummary(button.dataset.slug);
        if (!item) return;
        try {
            if (button.dataset.summaryAdmin === 'edit') editSummary(item.slug);
            if (button.dataset.summaryAdmin === 'toggle') await toggleSummary(item);
            if (button.dataset.summaryAdmin === 'delete') await deleteSummary(item);
        } catch (error) {
            notify(error.message, 5000);
        }
    });
}
