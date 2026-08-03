import { api } from '../core/api.js';
import { $, $$, escapeHtml, toast } from '../core/dom.js';
import { state } from '../core/state.js';

let historyResponses = [];
let activeHistoryFilter = 'all';

function openModal(selector) {
    const modal = $(selector);
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modal.querySelector('.modal-close')?.focus();
}

function closeModal(selector) {
    $(selector).classList.add('hidden');
    if ($$('.modal-overlay:not(.hidden)').length === 0) {
        document.body.classList.remove('modal-open');
    }
}

function bindModalDismiss(modalSelector, closeSelector) {
    $(closeSelector).addEventListener('click', () => closeModal(modalSelector));
    $(modalSelector).addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeModal(modalSelector);
    });
}

export function bindReportEvents() {
    $('#navHistory').addEventListener('click', loadHistory);
    $('#navRanking').addEventListener('click', loadRanking);
    $('#historyRefresh').addEventListener('click', loadHistoryData);
    $('#rankingRefresh').addEventListener('click', loadRankingData);
    $('#historyReset').addEventListener('click', () => resetOwnResults('histórico'));
    $('#rankingReset').addEventListener('click', () => resetOwnResults('ranking'));

    $$('.history-filter').forEach((button) => {
        button.addEventListener('click', () => {
            activeHistoryFilter = button.dataset.historyFilter;
            $$('.history-filter').forEach((item) => item.classList.toggle('active', item === button));
            renderHistoryResponses();
        });
    });

    bindModalDismiss('#historyModal', '#historyClose');
    bindModalDismiss('#rankingModal', '#rankingClose');
    bindModalDismiss('#reviewModal', '#reviewClose');

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeModal('#reviewModal');
        closeModal('#historyModal');
        closeModal('#rankingModal');
    });
}

async function loadHistory() {
    openModal('#historyModal');
    await loadHistoryData();
}

async function loadHistoryData() {
    $('#historyList').innerHTML = '<div class="report-loading">Carregando histórico…</div>';

    try {
        const data = await api('sessoes?detalhado=1');
        const sessions = data.sessoes || [];
        historyResponses = data.respostas || [];

        const answered = historyResponses.filter((item) => !item.pulada).length;
        const correct = historyResponses.filter((item) => item.acertou).length;
        const wrong = historyResponses.filter((item) => !item.acertou && !item.pulada).length;
        const percentage = answered ? Math.round((correct / answered) * 100) : 0;

        const statistics = [
            [answered, 'Resolvidas', '◎', ''],
            [correct, 'Acertos', '✓', 'is-correct'],
            [wrong, 'Erros', '×', 'is-wrong'],
            [`${percentage}%`, 'Aproveitamento', '↗', '']
        ];

        $('#historyStats').innerHTML = statistics.map(([value, label, icon, className]) => `
            <article class="history-stat-v5 ${className}">
                <span class="history-stat-icon">${icon}</span>
                <strong>${value}</strong>
                <span>${label}</span>
            </article>
        `).join('');

        if (!historyResponses.length && sessions.length) {
            $('#historyList').innerHTML = '<div class="report-empty">As sessões antigas não possuem respostas detalhadas registradas.</div>';
            return;
        }

        renderHistoryResponses();
    } catch (error) {
        $('#historyList').innerHTML = '<div class="report-empty">Não foi possível carregar o histórico.</div>';
        toast(error.message);
    }
}

function renderHistoryResponses() {
    const filtered = historyResponses.filter((item) => {
        if (activeHistoryFilter === 'correct') return item.acertou;
        if (activeHistoryFilter === 'wrong') return !item.acertou && !item.pulada;
        return !item.pulada;
    });

    $('#historyList').innerHTML = filtered.length
        ? filtered.map((item, index) => {
            const question = item.questoes || {};
            const chapter = question.capitulos?.nome || 'Capítulo não informado';
            const discipline = question.disciplinas?.nome || 'Disciplina';
            const statusClass = item.acertou ? 'is-correct' : 'is-wrong';
            const statusIcon = item.acertou ? '✓' : '×';

            return `
                <article class="history-answer-card ${statusClass}">
                    <span class="history-answer-status">${statusIcon}</span>
                    <div class="history-answer-copy">
                        <span class="history-answer-chapter">${escapeHtml(discipline)} · ${escapeHtml(chapter)}</span>
                        <strong>${escapeHtml(question.enunciado || 'Questão indisponível')}</strong>
                    </div>
                    <button class="btn ghost mini history-review-button" data-review-index="${index}" type="button">Revisar</button>
                </article>
            `;
        }).join('')
        : '<div class="report-empty">Nenhuma resposta encontrada para este filtro.</div>';

    $$('[data-review-index]').forEach((button) => {
        button.addEventListener('click', () => reviewQuestion(filtered[Number(button.dataset.reviewIndex)]));
    });
}

function reviewQuestion(item) {
    const question = item.questoes || {};
    const alternatives = question.alternativas || [];
    const marked = item.resposta_marcada;
    const correct = question.resposta_correta;

    $('#reviewContent').innerHTML = `
        <div class="review-question-meta">
            ${escapeHtml(question.disciplinas?.nome || 'Disciplina')} · ${escapeHtml(question.capitulos?.nome || 'Capítulo')}
        </div>
        <h3 class="review-question-title">${escapeHtml(question.enunciado || '')}</h3>
        <div class="review-options">
            ${alternatives.map((alternative, index) => {
                const classes = [index === correct ? 'correct' : '', index === marked && index !== correct ? 'incorrect' : ''].filter(Boolean).join(' ');
                return `<div class="review-option ${classes}"><span>${String.fromCharCode(65 + index)}</span><p>${escapeHtml(alternative)}</p></div>`;
            }).join('')}
        </div>
        <div class="review-result ${item.acertou ? 'is-correct' : 'is-wrong'}">
            Sua resposta: <strong>${marked == null ? 'Não respondida' : String.fromCharCode(65 + marked)}</strong>
            · Gabarito: <strong>${String.fromCharCode(65 + correct)}</strong>
        </div>
        <div class="resolution"><strong>Resolução</strong><p>${escapeHtml(question.resolucao || 'Sem resolução cadastrada.')}</p></div>
    `;

    openModal('#reviewModal');
}

async function loadRanking() {
    openModal('#rankingModal');
    await loadRankingData();
}

async function loadRankingData() {
    $('#rankingList').innerHTML = '<div class="report-loading">Carregando ranking…</div>';
    $('#rankingPodium').innerHTML = '';
    $('#myRankingCard').innerHTML = '';

    try {
        const ranking = (await api('ranking')).ranking || [];
        const podium = ranking.slice(0, 3);
        const myIndex = ranking.findIndex((entry) => entry.usuario_id === state.user.id || entry.usuario === state.user.usuario);
        const mine = myIndex >= 0 ? ranking[myIndex] : null;

        $('#myRankingCard').innerHTML = mine
            ? `<span>Sua colocação</span><strong>${myIndex + 1}º</strong><div><b>${escapeHtml(mine.nome)}</b><small>${mine.acertos} acertos · ${mine.respondidas} respondidas · ${mine.percentual}%</small></div>`
            : '<span>Sua colocação</span><strong>—</strong><div><b>Sem pontuação</b><small>Conclua um simulado para entrar no ranking.</small></div>';

        $('#rankingPodium').innerHTML = podium.length
            ? podium.map((entry, index) => `
                <article class="podium-card podium-${index + 1}">
                    <span class="podium-position">${index + 1}º</span>
                    <div class="ranking-avatar">${initials(entry.nome)}</div>
                    <strong>${escapeHtml(entry.nome)}</strong>
                    <small>AL SD PM Nº: ${escapeHtml(entry.usuario)}</small>
                    <b>${entry.acertos} acertos</b>
                    <span>${entry.percentual}% de aproveitamento</span>
                </article>
            `).join('')
            : '';

        $('#rankingList').innerHTML = ranking.length
            ? ranking.map((entry, index) => `
                <article class="ranking-card ${index < 3 ? 'is-top' : ''} ${entry.usuario === state.user.usuario ? 'is-me' : ''}">
                    <div class="ranking-card-main">
                        <span class="ranking-position">${index + 1}</span>
                        <div class="ranking-avatar small">${initials(entry.nome)}</div>
                        <div>
                            <strong>${escapeHtml(entry.nome)}</strong>
                            <p>AL SD PM Nº: ${escapeHtml(entry.usuario)} · ${entry.sessoes} sessões</p>
                        </div>
                    </div>
                    <div class="ranking-card-score">
                        <strong>${entry.acertos}</strong>
                        <span>acertos</span>
                        <small>${entry.percentual}% · ${entry.respondidas} questões</small>
                    </div>
                </article>
            `).join('')
            : '<div class="report-empty">Nenhum resultado disponível no ranking.</div>';
    } catch (error) {
        $('#rankingList').innerHTML = '<div class="report-empty">Não foi possível carregar o ranking.</div>';
        toast(error.message);
    }
}

function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'AL';
}

async function resetOwnResults(label) {
    if (!confirm(`Resetar seu ${label}? Esta ação apagará os resultados utilizados no histórico e no ranking.`)) return;

    try {
        await api('sessoes', { method: 'DELETE' });
        toast('Resultados resetados.');
        await Promise.all([loadHistoryData(), loadRankingData()]);
    } catch (error) {
        toast(error.message);
    }
}
