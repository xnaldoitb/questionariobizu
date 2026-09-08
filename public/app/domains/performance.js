import { requestJson } from '../foundation/request.js';
import { one, all, safeText, notify } from '../foundation/selectors.js';
import { appState } from '../foundation/model.js';
import { accountBadges } from '../foundation/badges.js';
import { patentButtonMarkup } from '../foundation/patents.js';

let historyResponses = [];
let activeHistoryFilter = 'all';
let historyPage = 1;
let historyHasMore = false;
const HISTORY_PAGE_SIZE = 20;

function openModal(selector) {
    const modal = one(selector);
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modal.querySelector('.modal-close')?.focus();
}

function closeModal(selector) {
    one(selector).classList.add('hidden');
    if (all('.modal-overlay:not(.hidden)').length === 0) {
        document.body.classList.remove('modal-open');
    }
}

function bindModalDismiss(modalSelector, closeSelector) {
    one(closeSelector).addEventListener('click', () => closeModal(modalSelector));
    one(modalSelector).addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeModal(modalSelector);
    });
}


function rankBadge(index) {
    const badges = [
        ['🥇', '1º colocado'],
        ['🥈', '2º colocado'],
        ['🥉', '3º colocado'],
    ];
    const badge = badges[index];
    if (!badge) return '';
    return `<span class="ranking-medal ranking-medal-${index + 1}" title="${badge[1]}" aria-label="${badge[1]}">${badge[0]}</span>`;
}

function developerEntry(entry) {
    return entry?.perfil === 'supremo';
}

function adminEntry(entry) {
    return entry?.perfil === 'admin';
}

export function bindPerformanceEvents() {
    one('#navHistory').addEventListener('click', openHistory);
    one('#navRanking').addEventListener('click', openRanking);
    one('#historyRefresh').addEventListener('click', refreshHistory);
    one('#rankingRefresh').addEventListener('click', refreshRanking);
    one('#historyReset').addEventListener('click', () => resetOwnResults('histórico'));
    one('#rankingReset').addEventListener('click', () => resetOwnResults('ranking'));

    all('.history-filter').forEach((button) => {
        button.addEventListener('click', () => {
            activeHistoryFilter = button.dataset.historyFilter;
            all('.history-filter').forEach((item) => item.classList.toggle('active', item === button));
            historyPage = 1;
            historyResponses = [];
            refreshHistory();
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

async function openHistory() {
    openModal('#historyModal');
    await refreshHistory();
}

async function refreshHistory({ append = false } = {}) {
    if (!append) {
        historyPage = 1;
        historyResponses = [];
        one('#historyList').innerHTML = '<div class="report-loading">Carregando histórico…</div>';
    }

    try {
        const data = await requestJson(
            `sessoes?detalhado=1&pagina=${historyPage}` +
            `&por_pagina=${HISTORY_PAGE_SIZE}` +
            `&filtro=${encodeURIComponent(activeHistoryFilter)}`
        );

        const pageResponses = data.respostas || [];
        historyResponses = append
            ? [...historyResponses, ...pageResponses]
            : pageResponses;
        historyHasMore = Boolean(data.paginacao?.tem_mais);

        const stats = data.estatisticas || {};
        const statistics = [
            [stats.respondidas || 0, 'Resolvidas', '◎', ''],
            [stats.acertos || 0, 'Acertos', '✓', 'is-correct'],
            [stats.erros || 0, 'Erros', '×', 'is-wrong'],
            [`${stats.percentual || 0}%`, 'Aproveitamento', '↗', ''],
        ];

        one('#historyStats').innerHTML = statistics.map(([value, label, icon, className]) => `
            <article class="history-stat-v5 ${className}">
                <span class="history-stat-icon">${icon}</span>
                <strong>${value}</strong>
                <span>${label}</span>
            </article>
        `).join('');

        if (!historyResponses.length && Number(data.sessoes_total || 0) > 0) {
            one('#historyList').innerHTML = '<div class="report-empty">Nenhuma resposta detalhada encontrada para este filtro.</div>';
            return;
        }

        renderHistoryEntries();
    } catch (error) {
        one('#historyList').innerHTML = '<div class="report-empty">Não foi possível carregar o histórico.</div>';
        notify(error.message);
    }
}

function renderHistoryEntries() {
    const cards = historyResponses.map((item, index) => {
        const question = item.questoes || {};
        const chapter = question.capitulos?.nome || 'Capítulo não informado';
        const discipline = question.disciplinas?.nome || 'Disciplina';
        const statusClass = item.acertou ? 'is-correct' : 'is-wrong';
        const statusIcon = item.acertou ? '✓' : '×';
        const removedMark = question.removida
            ? '<span class="history-archived-badge" title="Questão preservada no histórico após substituição">arquivada</span>'
            : '';

        return `
            <article class="history-answer-card ${statusClass}">
                <span class="history-answer-status">${statusIcon}</span>
                <div class="history-answer-copy">
                    <span class="history-answer-chapter">${safeText(discipline)} · ${safeText(chapter)} ${removedMark}</span>
                    <strong>${safeText(question.enunciado || 'Questão indisponível')}</strong>
                </div>
                <button class="ui-button quiet-action mini history-review-button" data-review-index="${index}" type="button">Revisar</button>
            </article>
        `;
    }).join('');

    const loadMore = historyHasMore
        ? `<div class="history-load-more-wrap">
            <button class="ui-button quiet-action history-load-more" id="historyLoadMore" type="button">Carregar mais 20</button>
           </div>`
        : '';

    one('#historyList').innerHTML = historyResponses.length
        ? cards + loadMore
        : '<div class="report-empty">Nenhuma resposta encontrada para este filtro.</div>';

    all('[data-review-index]').forEach((button) => {
        button.addEventListener('click', () => reviewQuestion(
            historyResponses[Number(button.dataset.reviewIndex)]
        ));
    });

    one('#historyLoadMore')?.addEventListener('click', async () => {
        historyPage += 1;
        const button = one('#historyLoadMore');
        if (button) {
            button.disabled = true;
            button.textContent = 'Carregando…';
        }
        await refreshHistory({ append: true });
    });
}

function reviewQuestion(item) {
    const question = item.questoes || {};
    const alternatives = question.alternativas || [];
    const marked = item.resposta_marcada;
    const correct = question.resposta_correta;

    one('#reviewContent').innerHTML = `
        <div class="review-question-meta">
            ${safeText(question.disciplinas?.nome || 'Disciplina')} · ${safeText(question.capitulos?.nome || 'Capítulo')}
            ${question.removida ? '<span class="history-archived-badge">arquivada</span>' : ''}
        </div>
        <h3 class="review-question-title">${safeText(question.enunciado || '')}</h3>
        <div class="review-options">
            ${alternatives.map((alternative, index) => {
                const classes = [index === correct ? 'correct' : '', index === marked && index !== correct ? 'incorrect' : ''].filter(Boolean).join(' ');
                return `<div class="review-option ${classes}"><span>${String.fromCharCode(65 + index)}</span><p>${safeText(alternative)}</p></div>`;
            }).join('')}
        </div>
        <div class="review-result ${item.acertou ? 'is-correct' : 'is-wrong'}">
            Sua resposta: <strong>${marked == null ? 'Não respondida' : String.fromCharCode(65 + marked)}</strong>
            · Gabarito: <strong>${correct == null ? '—' : String.fromCharCode(65 + correct)}</strong>
        </div>
        <div class="answer-explanation"><strong>Resolução</strong><p>${safeText(question.resolucao || 'Sem resolução cadastrada.')}</p></div>
    `;

    openModal('#reviewModal');
}

async function openRanking() {
    openModal('#rankingModal');
    await refreshRanking();
}

async function refreshRanking() {
    one('#rankingList').innerHTML = '<div class="report-loading">Carregando ranking…</div>';
    one('#rankingPodium').innerHTML = '';

    try {
        const ranking = (await requestJson('ranking')).ranking || [];
        const podium = ranking.slice(0, 3);

        one('#rankingPodium').innerHTML = podium.length
            ? podium.map((entry, index) => `
                <article class="podium-card podium-${index + 1}">
                    <div class="podium-emblem-row">${index === 0
                        ? patentButtonMarkup(entry.xp_total, { papirao: true })
                        : `<span class="podium-position">${rankBadge(index)} ${index + 1}º</span>${patentButtonMarkup(entry.xp_total, { developer: developerEntry(entry), admin: adminEntry(entry) })}`}</div>
                    <div class="podium-identity">
                        <div class="podium-name-line"><strong>${safeText(entry.nome)}</strong></div>
                        <div class="podium-account-badges">${accountBadges(entry)}</div>
                        <small>AL SD PM Nº: ${safeText(entry.usuario)}</small>
                    </div>
                    <div class="podium-results">
                        <span><b>${entry.acertos}</b><small>acertos</small></span>
                        <span><b>${entry.percentual}%</b><small>aproveitamento</small></span>
                    </div>
                </article>
            `).join('')
            : '';

        one('#rankingList').innerHTML = ranking.length
            ? ranking.map((entry, index) => `
                <article class="ranking-card ${index < 3 ? 'is-top' : ''} ${entry.usuario === appState.user.usuario ? 'is-me' : ''}">
                    <span class="ranking-position">${index + 1}º</span>
                    <div class="ranking-card-emblem">${patentButtonMarkup(entry.xp_total, { developer: developerEntry(entry), admin: adminEntry(entry) })}</div>
                    <div class="ranking-person">
                        <div class="ranking-name-line"><strong>${safeText(entry.nome)}</strong></div>
                        <div class="ranking-account-badges">${accountBadges(entry)}</div>
                        <small>AL SD PM Nº: ${safeText(entry.usuario)}</small>
                    </div>
                    <div class="ranking-card-score">
                        <span class="ranking-primary-score"><strong>${entry.acertos}</strong><small>acertos</small></span>
                        <span class="ranking-secondary-score"><strong>${entry.percentual}%</strong><small>${entry.respondidas} questões</small></span>
                    </div>
                </article>
            `).join('')
            : '<div class="report-empty">Nenhuma resposta disponível no ranking.</div>';
    } catch (error) {
        one('#rankingList').innerHTML = '<div class="report-empty">Não foi possível carregar o ranking.</div>';
        notify(error.message);
    }
}

async function resetOwnResults(label) {
    if (!confirm(`Resetar seu ${label}? Esta ação apagará os resultados utilizados no histórico e no ranking.`)) return;

    try {
        await requestJson('sessoes', { method: 'DELETE' });
        notify('Resultados resetados.');
        await Promise.all([refreshHistory(), refreshRanking()]);
        document.dispatchEvent(new CustomEvent('quiz:progress-changed'));
    } catch (error) {
        notify(error.message);
    }
}
