import { requestJson } from '../../foundation/request.js';
import { one, safeText, notify } from '../../foundation/selectors.js';
import { refreshCatalog } from '../catalog.js';
import {
    adminState,
    closeAdminModal,
    openAdminModal,
} from './common.js';

function disciplineById(id) {
    return adminState.catalog.disciplinas.find((item) => item.id === id);
}

function chapterById(id) {
    return adminState.catalog.capitulos.find((item) => String(item.id) === String(id));
}

export function populateAdminCatalogSelectors() {
    const allDisciplines = adminState.catalog.disciplinas;
    const options = allDisciplines.map((discipline) => `
        <option value="${safeText(discipline.id)}">${safeText(discipline.nome)}${discipline.ativo ? '' : ' (inativa)'}</option>
    `).join('');

    const questionFilter = one('#questionFilterSubject');
    if (questionFilter) questionFilter.innerHTML = `<option value="">Todas</option>${options}`;

    const maintenance = one('#maintenanceDiscipline');
    if (maintenance) maintenance.innerHTML = options || '<option value="">Nenhuma disciplina</option>';

    document.dispatchEvent(new CustomEvent('admin:catalog-updated'));
}

function renderChapter(chapter) {
    return `
        <div class="admin-content-row ${chapter.ativo ? '' : 'is-inactive'}">
            <div>
                <strong>${safeText(chapter.nome)}</strong>
                <small>Ordem ${chapter.indice} · ${chapter.questoes_total || 0} questão(ões) · ${chapter.ativo ? 'ativo' : 'inativo'}</small>
            </div>
            <div class="data-actions">
                <button class="ui-button quiet-action mini" data-content-command="edit-chapter" data-content-id="${chapter.id}" type="button">Editar</button>
                <button class="ui-button quiet-action mini ${chapter.ativo ? 'danger' : ''}" data-content-command="toggle-chapter" data-content-id="${chapter.id}" type="button">${chapter.ativo ? 'Desativar' : 'Reativar'}</button>
            </div>
        </div>
    `;
}

export function renderManagedCatalog() {
    const container = one('#catalogAdminList');
    if (!container) return;

    const disciplines = adminState.catalog.disciplinas;
    container.innerHTML = disciplines.length
        ? disciplines.map((discipline) => {
            const chapters = adminState.catalog.capitulos.filter((chapter) => chapter.disciplina_id === discipline.id);
            return `
                <details class="catalog-group admin-content-group ${discipline.ativo ? '' : 'is-inactive'}">
                    <summary class="admin-content-summary">
                        <div class="catalog-discipline-title">
                            <strong>${safeText(discipline.nome)}</strong>
                            <small>${safeText(discipline.id)} · ${discipline.questoes_total || 0} questão(ões) · ${chapters.length} capítulo(s)</small>
                        </div>
                        <span class="admin-status-pill ${discipline.ativo ? 'status-ativo' : 'status-desativado'}">${discipline.ativo ? 'ativa' : 'inativa'}</span>
                    </summary>
                    <div class="admin-content-body">
                        <p class="muted">${safeText(discipline.descricao || 'Sem descrição.')}</p>
                        <div class="data-actions admin-content-actions">
                            <button class="ui-button quiet-action mini" data-content-command="edit-discipline" data-content-id="${safeText(discipline.id)}" type="button">Editar disciplina</button>
                            <button class="ui-button quiet-action mini ${discipline.ativo ? 'danger' : ''}" data-content-command="toggle-discipline" data-content-id="${safeText(discipline.id)}" type="button">${discipline.ativo ? 'Desativar' : 'Reativar'}</button>
                        </div>
                        <div class="admin-chapter-list">
                            ${chapters.length ? chapters.map(renderChapter).join('') : '<div class="admin-empty-state">Sem capítulos cadastrados.</div>'}
                        </div>
                    </div>
                </details>
            `;
        }).join('')
        : '<div class="admin-empty-state">Nenhuma disciplina cadastrada.</div>';
}

export async function refreshAdminCatalog({ quiet = false } = {}) {
    try {
        adminState.catalog = await requestJson('admin-catalogo');
        renderManagedCatalog();
        populateAdminCatalogSelectors();
        return adminState.catalog;
    } catch (error) {
        if (!quiet) notify(error.message);
        throw error;
    }
}

async function createDiscipline(event) {
    event.preventDefault();
    try {
        await requestJson('admin-catalogo', {
            method: 'POST',
            body: JSON.stringify({ tipo: 'disciplina', ...Object.fromEntries(new FormData(event.currentTarget)) }),
        });
        event.currentTarget.reset();
        await Promise.all([refreshAdminCatalog(), refreshCatalog()]);
        notify('Disciplina adicionada.');
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function createChapter(event) {
    event.preventDefault();
    try {
        await requestJson('admin-catalogo', {
            method: 'POST',
            body: JSON.stringify({ tipo: 'capitulo', ...Object.fromEntries(new FormData(event.currentTarget)) }),
        });
        event.currentTarget.reset();
        await Promise.all([refreshAdminCatalog(), refreshCatalog()]);
        notify('Capítulo adicionado.');
    } catch (error) {
        notify(error.message, 4200);
    }
}

function openContentEdit(command, id) {
    const isDiscipline = command === 'edit-discipline';
    const item = isDiscipline ? disciplineById(id) : chapterById(id);
    if (!item) return;

    one('#contentEditType').value = isDiscipline ? 'disciplina' : 'capitulo';
    one('#contentEditId').value = item.id;
    one('#contentEditName').value = item.nome || '';
    one('#contentEditOrder').value = isDiscipline ? item.ordem ?? 0 : item.indice ?? 0;
    one('#contentEditDescription').value = isDiscipline ? item.descricao || '' : '';
    one('#contentDescriptionField').classList.toggle('hidden', !isDiscipline);
    one('#contentEditTitle').textContent = isDiscipline ? `Editar ${item.nome}` : `Editar capítulo — ${item.nome}`;
    openAdminModal('contentEditModal');
}

async function saveContentEdit(event) {
    event.preventDefault();
    const type = one('#contentEditType').value;
    const payload = {
        tipo: type,
        id: one('#contentEditId').value,
        nome: one('#contentEditName').value,
    };

    if (type === 'disciplina') {
        payload.descricao = one('#contentEditDescription').value;
        payload.ordem = one('#contentEditOrder').value;
    } else {
        payload.indice = one('#contentEditOrder').value;
    }

    try {
        await requestJson('admin-catalogo', { method: 'PUT', body: JSON.stringify(payload) });
        closeAdminModal('contentEditModal');
        await Promise.all([refreshAdminCatalog(), refreshCatalog()]);
        notify('Conteúdo atualizado.');
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function toggleContent(command, id) {
    const isDiscipline = command === 'toggle-discipline';
    const item = isDiscipline ? disciplineById(id) : chapterById(id);
    if (!item) return;

    const next = !item.ativo;
    if (!confirm(`${next ? 'Reativar' : 'Desativar'} “${item.nome}”?`)) return;

    try {
        await requestJson('admin-catalogo', {
            method: 'PUT',
            body: JSON.stringify({
                tipo: isDiscipline ? 'disciplina' : 'capitulo',
                id: item.id,
                ativo: next,
            }),
        });
        await Promise.all([refreshAdminCatalog(), refreshCatalog()]);
        notify(next ? 'Item reativado.' : 'Item desativado.');
    } catch (error) {
        notify(error.message, 4200);
    }
}

export function bindContentManagement() {
    one('#disciplineForm')?.addEventListener('submit', createDiscipline);
    one('#chapterForm')?.addEventListener('submit', createChapter);
    one('#contentEditForm')?.addEventListener('submit', saveContentEdit);
    one('#refreshCatalogAdmin')?.addEventListener('click', () => refreshAdminCatalog());

    one('#catalogAdminList')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-content-command]');
        if (!button) return;

        const command = button.dataset.contentCommand;
        const id = button.dataset.contentId;
        if (command.startsWith('edit-')) openContentEdit(command, id);
        if (command.startsWith('toggle-')) toggleContent(command, id);
    });
}
