import { requestJson } from '../../foundation/request.js';
import { one, safeText, notify } from '../../foundation/selectors.js';
import { populateSubjectSelectors } from '../catalog.js';
import { adminState, closeAdminModal, openAdminModal } from './common.js';
import { refreshAdminCatalog } from './content.js';

let searchTimer = null;

function clean(value) {
    return String(value ?? '').trim();
}

function currentFilters() {
    return {
        busca: clean(one('#questionSearch')?.value),
        disciplina: one('#questionFilterSubject')?.value || '',
        capitulo: one('#questionFilterChapter')?.value || '',
        tipo: one('#questionFilterType')?.value || '',
        status: one('#questionFilterStatus')?.value || 'todas',
    };
}

function buildQuestionQuery(page = 1) {
    const params = new URLSearchParams({ page: String(page), page_size: '20' });
    const filters = currentFilters();
    Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'todas') params.set(key, value);
    });
    return `admin-questions?${params.toString()}`;
}

function typeLabel(type) {
    return type === 'certo_errado' ? 'Certo / Errado' : 'Múltipla escolha';
}

function answerLabel(question) {
    if (question.tipo === 'certo_errado') {
        return question.resposta_correta === 0 ? 'Certo' : 'Errado';
    }
    return 'ABCDE'[question.resposta_correta] || '—';
}

function renderQuestionCard(question) {
    const discipline = question.disciplinas?.nome || question.disciplina_id;
    const chapter = question.capitulos?.nome || `Capítulo ${question.capitulo_id}`;

    return `
        <article class="admin-question-card ${question.ativo ? '' : 'is-inactive'}">
            <div class="admin-question-card-head">
                <div class="admin-question-meta">
                    <strong>#${question.id} · ${safeText(discipline)}</strong>
                    <span>${safeText(chapter)} · ${safeText(typeLabel(question.tipo))}</span>
                </div>
                <span class="admin-status-pill ${question.ativo ? 'status-ativo' : 'status-desativado'}">${question.ativo ? 'ativa' : 'inativa'}</span>
            </div>
            <p class="admin-question-statement">${safeText(question.enunciado)}</p>
            <small class="admin-question-answer">Gabarito: ${safeText(answerLabel(question))}</small>
            <div class="data-actions admin-question-actions">
                <button class="ui-button quiet-action mini" data-question-command="edit" data-question-id="${question.id}" type="button">Editar</button>
                <button class="ui-button quiet-action mini" data-question-command="duplicate" data-question-id="${question.id}" type="button">Duplicar</button>
                <button class="ui-button quiet-action mini ${question.ativo ? 'danger' : ''}" data-question-command="${question.ativo ? 'deactivate' : 'activate'}" data-question-id="${question.id}" type="button">${question.ativo ? 'Desativar' : 'Reativar'}</button>
            </div>
        </article>
    `;
}

function renderQuestions() {
    const list = one('#questionsAdminList');
    if (!list) return;

    list.innerHTML = adminState.questions.length
        ? adminState.questions.map(renderQuestionCard).join('')
        : '<div class="admin-empty-state">Nenhuma questão encontrada com estes filtros.</div>';

    one('#questionListMeta').textContent = `${adminState.questionsTotal} questão(ões) encontrada(s)`;
    one('#questionPagerInfo').textContent = `Página ${adminState.questionPage} de ${adminState.questionPages}`;
    one('#questionPagerPrev').disabled = adminState.questionPage <= 1;
    one('#questionPagerNext').disabled = adminState.questionPage >= adminState.questionPages;
}

export async function refreshAdminQuestions({ page = 1, quiet = false } = {}) {
    try {
        const response = await requestJson(buildQuestionQuery(page));
        adminState.questions = response.questoes || [];
        adminState.questionsTotal = response.total || 0;
        adminState.questionPage = response.pagina || 1;
        adminState.questionPages = response.paginas || 1;
        renderQuestions();
        return response;
    } catch (error) {
        one('#questionListMeta').textContent = error.message;
        if (!quiet) notify(error.message);
        throw error;
    }
}

function populateQuestionFilterChapters() {
    const disciplineId = one('#questionFilterSubject')?.value || '';
    const chapters = adminState.catalog.capitulos.filter((chapter) => !disciplineId || chapter.disciplina_id === disciplineId);
    one('#questionFilterChapter').innerHTML = `
        <option value="">Todos</option>
        ${chapters.map((chapter) => `<option value="${chapter.id}">${safeText(chapter.nome)}${chapter.ativo ? '' : ' (inativo)'}</option>`).join('')}
    `;
}

function renderCreateAlternatives() {
    const type = one('#questionType').value;
    const alternatives = type === 'certo_errado' ? ['Certo', 'Errado'] : ['A', 'B', 'C', 'D', 'E'];

    one('#alternativeInputs').innerHTML = alternatives.map((label, index) => {
        const optional = type !== 'certo_errado' && label === 'E';
        return `<label>Alternativa ${label}${optional ? ' (opcional)' : ''}<input name="alt${index}" value="${type === 'certo_errado' ? label : ''}" ${type === 'certo_errado' ? 'readonly' : ''} ${optional ? '' : 'required'}></label>`;
    }).join('');

    one('#correctAnswer').innerHTML = alternatives.map((label, index) => `<option value="${index}">${label}</option>`).join('');
}

async function createQuestion(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const alternatives = form.tipo === 'certo_errado'
        ? ['Certo', 'Errado']
        : [form.alt0, form.alt1, form.alt2, form.alt3, form.alt4].map(clean).filter(Boolean);

    if (form.tipo !== 'certo_errado' && ![4, 5].includes(alternatives.length)) {
        notify('Preencha as alternativas A, B, C e D. A alternativa E é opcional.');
        return;
    }

    if (Number(form.resposta_correta) >= alternatives.length) {
        notify('Selecione um gabarito compatível com as alternativas preenchidas.');
        return;
    }

    try {
        await requestJson('admin-questions', {
            method: 'POST',
            body: JSON.stringify({ ...form, alternativas: alternatives }),
        });
        event.currentTarget.reset();
        one('#questionType').value = 'multipla_escolha';
        renderCreateAlternatives();
        populateSubjectSelectors();
        await Promise.all([refreshAdminQuestions({ page: 1 }), refreshAdminCatalog({ quiet: true })]);
        notify('Questão cadastrada.');
    } catch (error) {
        notify(error.message, 4200);
    }
}

function findQuestion(id) {
    return adminState.questions.find((question) => String(question.id) === String(id));
}

function populateEditSubjects(selected) {
    one('#questionEditSubject').innerHTML = adminState.catalog.disciplinas.map((discipline) => `
        <option value="${safeText(discipline.id)}" ${discipline.id === selected ? 'selected' : ''}>${safeText(discipline.nome)}${discipline.ativo ? '' : ' (inativa)'}</option>
    `).join('');
}

function populateEditChapters(disciplineId, selected) {
    const chapters = adminState.catalog.capitulos.filter((chapter) => chapter.disciplina_id === disciplineId);
    one('#questionEditChapter').innerHTML = chapters.map((chapter) => `
        <option value="${chapter.id}" ${String(chapter.id) === String(selected) ? 'selected' : ''}>${safeText(chapter.nome)}${chapter.ativo ? '' : ' (inativo)'}</option>
    `).join('');
}

function renderEditAlternatives(type, values = [], correct = 0) {
    const count = type === 'certo_errado' ? 2 : 5;
    const labels = type === 'certo_errado' ? ['Certo', 'Errado'] : ['A', 'B', 'C', 'D', 'E'];

    one('#questionEditAlternatives').innerHTML = Array.from({ length: count }, (_, index) => {
        const optional = type !== 'certo_errado' && index === 4;
        const value = type === 'certo_errado' ? labels[index] : values[index] || '';
        return `<label>Alternativa ${labels[index]}${optional ? ' (opcional)' : ''}<input data-edit-alt="${index}" value="${safeText(value)}" ${type === 'certo_errado' ? 'readonly' : ''} ${optional ? '' : 'required'}></label>`;
    }).join('');

    one('#questionEditCorrect').innerHTML = labels.map((label, index) => `<option value="${index}" ${index === Number(correct) ? 'selected' : ''}>${label}</option>`).join('');
}

function openQuestionEdit(id) {
    const question = findQuestion(id);
    if (!question) return;

    one('#questionEditId').value = question.id;
    populateEditSubjects(question.disciplina_id);
    populateEditChapters(question.disciplina_id, question.capitulo_id);
    one('#questionEditType').value = question.tipo;
    one('#questionEditStatement').value = question.enunciado || '';
    renderEditAlternatives(question.tipo, question.alternativas || [], question.resposta_correta);
    one('#questionEditResolution').value = question.resolucao || '';
    one('#questionEditDifficulty').value = question.dificuldade || 'media';
    one('#questionEditSource').value = question.fonte || '';
    one('#questionEditTitle').textContent = `Editar questão #${question.id}`;
    openAdminModal('questionEditModal');
}

async function saveQuestionEdit(event) {
    event.preventDefault();
    const type = one('#questionEditType').value;
    const alternatives = [...document.querySelectorAll('#questionEditAlternatives [data-edit-alt]')]
        .map((input) => clean(input.value))
        .filter(Boolean);

    const payload = {
        id: Number(one('#questionEditId').value),
        action: 'update',
        disciplina_id: one('#questionEditSubject').value,
        capitulo_id: Number(one('#questionEditChapter').value),
        tipo: type,
        enunciado: one('#questionEditStatement').value,
        alternativas,
        resposta_correta: Number(one('#questionEditCorrect').value),
        resolucao: one('#questionEditResolution').value,
        dificuldade: one('#questionEditDifficulty').value,
        fonte: one('#questionEditSource').value,
    };

    try {
        await requestJson('admin-questions', { method: 'PUT', body: JSON.stringify(payload) });
        closeAdminModal('questionEditModal');
        await refreshAdminQuestions({ page: adminState.questionPage });
        notify('Questão atualizada.');
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function handleQuestionCommand(button) {
    const id = Number(button.dataset.questionId);
    const command = button.dataset.questionCommand;
    if (command === 'edit') return openQuestionEdit(id);

    const confirmations = {
        duplicate: 'Duplicar esta questão? A cópia será criada como ativa.',
        deactivate: 'Desativar esta questão? Ela deixará de aparecer para os alunos.',
        activate: 'Reativar esta questão?',
    };
    if (confirmations[command] && !confirm(confirmations[command])) return;

    try {
        await requestJson('admin-questions', {
            method: 'PUT',
            body: JSON.stringify({ id, action: command }),
        });
        await Promise.all([
            refreshAdminQuestions({ page: adminState.questionPage }),
            refreshAdminCatalog({ quiet: true }),
        ]);
        notify(command === 'duplicate' ? 'Questão duplicada.' : 'Status da questão atualizado.');
    } catch (error) {
        notify(error.message, 4200);
    }
}

function scheduleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refreshAdminQuestions({ page: 1 }), 350);
}

export function bindQuestionManagement() {
    one('#questionForm')?.addEventListener('submit', createQuestion);
    one('#questionType')?.addEventListener('change', renderCreateAlternatives);
    one('#questionRefreshBtn')?.addEventListener('click', () => refreshAdminQuestions({ page: adminState.questionPage }));
    one('#questionSearch')?.addEventListener('input', scheduleSearch);

    ['#questionFilterType', '#questionFilterStatus', '#questionFilterChapter'].forEach((selector) => {
        one(selector)?.addEventListener('change', () => refreshAdminQuestions({ page: 1 }));
    });

    one('#questionFilterSubject')?.addEventListener('change', () => {
        populateQuestionFilterChapters();
        refreshAdminQuestions({ page: 1 });
    });

    one('#questionPagerPrev')?.addEventListener('click', () => refreshAdminQuestions({ page: adminState.questionPage - 1 }));
    one('#questionPagerNext')?.addEventListener('click', () => refreshAdminQuestions({ page: adminState.questionPage + 1 }));

    one('#questionsAdminList')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-question-command]');
        if (button) handleQuestionCommand(button);
    });

    one('#questionEditForm')?.addEventListener('submit', saveQuestionEdit);
    one('#questionEditSubject')?.addEventListener('change', () => {
        populateEditChapters(one('#questionEditSubject').value, null);
    });
    one('#questionEditType')?.addEventListener('change', () => {
        renderEditAlternatives(one('#questionEditType').value, [], 0);
    });

    document.addEventListener('admin:catalog-updated', populateQuestionFilterChapters);
    renderCreateAlternatives();
}
