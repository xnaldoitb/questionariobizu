import { api } from '../core/api.js';
import { $, escapeHtml, toast } from '../core/dom.js';
import { showView } from '../core/views.js';

export function bindReportEvents() {
    $('#navHistory').addEventListener('click', loadHistory);
    $('#navRanking').addEventListener('click', loadRanking);
}

async function loadHistory() {
    showView('historyView');

    try {
        const sessions = (await api('sessoes')).sessoes;
        const sessionCount = sessions.length;
        const answered = sessions.reduce((total, session) => total + session.respondidas, 0);
        const correct = sessions.reduce((total, session) => total + session.acertos, 0);
        const percentage = answered ? Math.round((correct / answered) * 100) : 0;

        const statistics = [
            [sessionCount, 'Sessões'],
            [answered, 'Respondidas'],
            [correct, 'Acertos'],
            [`${percentage}%`, 'Aproveitamento']
        ];

        $('#historyStats').innerHTML = statistics.map(([value, label]) => `
            <div class="stat">
                <strong>${value}</strong>
                <span>${label}</span>
            </div>
        `).join('');

        $('#historyList').innerHTML = sessions.length
            ? sessions.map((session) => `
                <div class="history-item">
                    <div>
                        <strong>${escapeHtml(session.disciplinas?.nome || 'Simulado')}</strong>
                        <div class="muted">
                            ${escapeHtml(session.capitulos?.nome || 'Todos os capítulos')}
                            · ${new Date(session.finalizada_em).toLocaleString('pt-BR')}
                        </div>
                    </div>
                    <strong>${session.acertos}/${session.respondidas} · ${session.percentual}%</strong>
                </div>
            `).join('')
            : '<div class="panel">Nenhuma sessão concluída.</div>';
    } catch (error) {
        toast(error.message);
    }
}

async function loadRanking() {
    showView('rankingView');

    try {
        const ranking = (await api('ranking')).ranking;

        $('#rankingList').innerHTML = ranking.length
            ? ranking.map((entry, index) => `
                <div class="ranking-row">
                    <div class="ranking-main">
                        <span class="ranking-pos">${index + 1}º</span>
                        <div>
                            <strong>${escapeHtml(entry.nome)}</strong>
                            <div class="muted">
                                @${escapeHtml(entry.usuario)} · ${entry.sessoes} sessões
                            </div>
                        </div>
                    </div>
                    <div class="ranking-score">
                        <strong>${entry.acertos} acertos</strong>
                        <div class="muted">
                            ${entry.percentual}% · ${entry.respondidas} respondidas
                        </div>
                    </div>
                </div>
            `).join('')
            : 'Nenhum resultado no ranking.';
    } catch (error) {
        toast(error.message);
    }
}
