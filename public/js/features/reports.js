import { api } from '../core/api.js';
import { $, escapeHtml, toast } from '../core/dom.js';

function openModal(selector) {
    const modal = $(selector);
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modal.querySelector('.modal-close')?.focus();
}

function closeModal(selector) {
    $(selector).classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function bindModalDismiss(modalSelector, closeSelector) {
    $(closeSelector).addEventListener('click', () => closeModal(modalSelector));

    $(modalSelector).addEventListener('click', (event) => {
        if (event.target === event.currentTarget) {
            closeModal(modalSelector);
        }
    });
}

export function bindReportEvents() {
    $('#navHistory').addEventListener('click', loadHistory);
    $('#navRanking').addEventListener('click', loadRanking);
    $('#historyRefresh').addEventListener('click', loadHistoryData);
    $('#rankingRefresh').addEventListener('click', loadRankingData);

    bindModalDismiss('#historyModal', '#historyClose');
    bindModalDismiss('#rankingModal', '#rankingClose');

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
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
        const sessions = (await api('sessoes')).sessoes;
        const sessionCount = sessions.length;
        const answered = sessions.reduce((total, session) => total + session.respondidas, 0);
        const correct = sessions.reduce((total, session) => total + session.acertos, 0);
        const percentage = answered ? Math.round((correct / answered) * 100) : 0;

        const statistics = [
            [sessionCount, 'Sessões', '▤'],
            [answered, 'Respondidas', '◎'],
            [correct, 'Acertos', '✓'],
            [`${percentage}%`, 'Aproveitamento', '↗']
        ];

        $('#historyStats').innerHTML = statistics.map(([value, label, icon]) => `
            <div class="report-stat">
                <span class="report-stat-icon">${icon}</span>
                <strong>${value}</strong>
                <span>${label}</span>
            </div>
        `).join('');

        $('#historyList').innerHTML = sessions.length
            ? sessions.map((session) => {
                const performanceClass = session.percentual >= 80
                    ? 'is-good'
                    : session.percentual >= 60
                        ? 'is-medium'
                        : 'is-low';

                return `
                    <article class="history-card">
                        <div class="history-card-main">
                            <span class="history-card-mark"></span>
                            <div>
                                <strong>${escapeHtml(session.disciplinas?.nome || 'Simulado')}</strong>
                                <p>${escapeHtml(session.capitulos?.nome || 'Todos os capítulos')}</p>
                                <time>${new Date(session.finalizada_em).toLocaleString('pt-BR')}</time>
                            </div>
                        </div>
                        <div class="history-card-score ${performanceClass}">
                            <strong>${session.acertos}/${session.respondidas}</strong>
                            <span>${session.percentual}%</span>
                        </div>
                    </article>
                `;
            }).join('')
            : '<div class="report-empty">Nenhuma sessão concluída até o momento.</div>';
    } catch (error) {
        $('#historyList').innerHTML = '<div class="report-empty">Não foi possível carregar o histórico.</div>';
        toast(error.message);
    }
}

async function loadRanking() {
    openModal('#rankingModal');
    await loadRankingData();
}

async function loadRankingData() {
    $('#rankingList').innerHTML = '<div class="report-loading">Carregando ranking…</div>';
    $('#rankingPodium').innerHTML = '';

    try {
        const ranking = (await api('ranking')).ranking;
        const podium = ranking.slice(0, 3);

        $('#rankingPodium').innerHTML = podium.length
            ? podium.map((entry, index) => `
                <article class="podium-card podium-${index + 1}">
                    <span class="podium-position">${index + 1}º</span>
                    <span class="podium-medal">${['★', '◆', '●'][index]}</span>
                    <strong>${escapeHtml(entry.nome)}</strong>
                    <small>@${escapeHtml(entry.usuario)}</small>
                    <b>${entry.acertos} acertos</b>
                    <span>${entry.percentual}% de aproveitamento</span>
                </article>
            `).join('')
            : '';

        $('#rankingList').innerHTML = ranking.length
            ? ranking.map((entry, index) => `
                <article class="ranking-card ${index < 3 ? 'is-top' : ''}">
                    <div class="ranking-card-main">
                        <span class="ranking-position">${index + 1}</span>
                        <div>
                            <strong>${escapeHtml(entry.nome)}</strong>
                            <p>@${escapeHtml(entry.usuario)} · ${entry.sessoes} sessões</p>
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
