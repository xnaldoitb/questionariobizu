import { requestJson } from '../foundation/request.js';
import { one, all, safeText, notify } from '../foundation/selectors.js';
import { appState } from '../foundation/model.js';
import { openScreen } from '../foundation/navigation.js';
import { prepareQuestionView, refreshAccessState, renderAccessBlocked } from './access.js';
import { syncSessionActivity } from './session-activity.js';
import { chapterSelectionIsValid, selectedChapterIds } from './chapter-selection.js';

let selectedAnswerIndex = null;
let eliminatedAnswerIndexes = new Set();

function resetStudyProgress() {
    appState.quiz.current = 0;
    appState.quiz.stats = {
        answered: 0,
        correct: 0,
        skipped: 0,
    };
}

export function bindStudyEvents() {
    one('#startBtn').addEventListener('click', startStudySession);
    one('#skipBtn').addEventListener('click', skipCurrentQuestion);
    one('#confirmAnswerBtn').addEventListener('click', confirmSelectedAnswer);
    one('#nextBtn').addEventListener('click', advanceQuestion);

    one('#backBtn').addEventListener('click', () => {
        if (window.confirm('Sair do simulado atual?')) {
            document.dispatchEvent(new CustomEvent('quiz:progress-changed'));
            openScreen('dashboard');
        }
    });

    one('#restartBtn').addEventListener('click', () => openScreen('dashboard'));
}

function reviewQuery(enabled) {
    return enabled ? '&revisao=pendentes_erros' : '';
}

async function fetchCompleteQuestionSet(disciplineId, chapterId, reviewOnly) {
    const questions = [];
    let page = 1;

    while (true) {
        const data = await requestJson(
            `questoes?disciplina=${encodeURIComponent(disciplineId)}` +
            `&capitulos=${encodeURIComponent(chapterId)}` +
            `&limite=all&pagina=${page}&por_pagina=250` +
            reviewQuery(reviewOnly)
        );

        questions.push(...(data.questoes || []));

        if (!data.paginacao?.tem_mais) break;
        page += 1;
    }

    return questions.sort(() => Math.random() - 0.5);
}

async function startStudySession() {
    try {
        const currentUser = await refreshAccessState();
        if (!currentUser.acesso_questoes) {
            renderAccessBlocked(currentUser);
            return;
        }

        prepareQuestionView();
        const disciplineId = one('#subjectSelect').value;
        if (!chapterSelectionIsValid()) throw new Error('Selecione pelo menos um capítulo ou escolha todos.');
        const chapterIds = selectedChapterIds();
        const chapterId = chapterIds.join(',');
        one('#chapterSelect').open = false;
        const limitValue = one('input[name="questionLimit"]:checked')?.value || 'all';
        const reviewOnly = Boolean(one('#reviewPendingOnly')?.checked);
        const allQuestions = limitValue === 'all';
        const limit = allQuestions ? 'all' : Number(limitValue);

        const startButton = one('#startBtn');
        const originalLabel = startButton.textContent;
        startButton.disabled = true;
        startButton.textContent = allQuestions ? 'Carregando todas…' : 'Carregando…';

        try {
            if (allQuestions) {
                appState.quiz.questions = await fetchCompleteQuestionSet(
                    disciplineId,
                    chapterId,
                    reviewOnly,
                );
            } else {
                const data = await requestJson(
                    `questoes?disciplina=${encodeURIComponent(disciplineId)}` +
                    `&capitulos=${encodeURIComponent(chapterId)}` +
                    `&limite=${limit}` +
                    reviewQuery(reviewOnly)
                );
                appState.quiz.questions = data.questoes.slice(0, Number(limit));
            }
        } finally {
            startButton.disabled = false;
            startButton.textContent = originalLabel;
        }

        if (!appState.quiz.questions.length) {
            throw new Error(
                reviewOnly
                    ? 'Não há questões pendentes ou erradas nesse filtro. Você já acertou todas as questões respondidas disponíveis.'
                    : 'Nenhuma questão encontrada nesse filtro.'
            );
        }

        const sessionData = await requestJson('sessoes', {
            method: 'POST',
            body: JSON.stringify({
                disciplina_id: disciplineId,
                capitulo_id: chapterIds.length === 1 ? chapterIds[0] : null,
                questoes_ids: appState.quiz.questions.map((question) => question.id),
                total: appState.quiz.questions.length,
            }),
        });

        appState.quiz.sessionId = sessionData.sessao.id;
        resetStudyProgress();
        openScreen('quizView');
        renderCurrentQuestion();
    } catch (error) {
        if (['TESTE_EXPIRADO', 'ACESSO_VENCIDO', 'ACESSO_QUESTOES_BLOQUEADO'].includes(error.code)) {
            renderAccessBlocked(error);
            return;
        }
        notify(error.message);
    }
}

function renderCurrentQuestion() {
    appState.quiz.locked = false;
    selectedAnswerIndex = null;
    eliminatedAnswerIndexes = new Set();

    const question = appState.quiz.questions[appState.quiz.current];
    const chapter = appState.catalog.capitulos.find(
        (item) => item.id === question.capitulo_id
    );

    one('#questionChapter').textContent = chapter?.nome || '';
    one('#questionNumber').textContent =
        `Questão ${appState.quiz.current + 1} de ${appState.quiz.questions.length}`;
    one('#questionText').textContent = question.enunciado;
    one('#resolution').classList.add('hidden');
    const trueFalseQuestion = question.tipo === 'certo_errado' || question.alternativas.length === 2;
    const toolsHint = one('#answerToolsHint');
    toolsHint.classList.toggle('without-scissors', trueFalseQuestion);
    toolsHint.innerHTML = trueFalseQuestion
        ? '<span aria-hidden="true">✓</span> Selecione <strong>Certo</strong> ou <strong>Errado</strong> e depois confirme sua resposta.'
        : '<span aria-hidden="true">✂</span> Use a tesoura para riscar alternativas que considerar incorretas. Depois selecione sua resposta e confirme.';

    const answerFeedback = one('#answerFeedback');
    answerFeedback.textContent = '';
    answerFeedback.classList.remove('is-correct', 'is-wrong');

    one('#answerList').innerHTML = question.alternativas.map((option, index) => {
        const letter = 'ABCDE'[index] || String(index + 1);
        return `
            <div class="answer-row ${trueFalseQuestion ? 'no-elimination' : ''}" data-answer-row="${index}">
                <button class="answer-choice" data-index="${index}" type="button">
                    <span class="answer-key">${letter}</span>
                    <span>${safeText(option)}</span>
                </button>
                ${trueFalseQuestion ? '' : `<button class="answer-eliminate" data-eliminate-index="${index}" type="button"
                    aria-label="Eliminar alternativa ${letter}" aria-pressed="false"
                    title="Eliminar ou restaurar a alternativa ${letter}">✂</button>`}
            </div>
        `;
    }).join('');

    all('.answer-choice').forEach((option) => {
        option.addEventListener('click', () => {
            selectAnswer(Number(option.dataset.index));
        });
    });

    all('.answer-eliminate').forEach((button) => {
        button.addEventListener('click', () => {
            toggleEliminatedAnswer(Number(button.dataset.eliminateIndex));
        });
    });

    const confirmButton = one('#confirmAnswerBtn');
    confirmButton.disabled = true;
    confirmButton.textContent = 'Confirmar resposta';
    one('#skipBtn').disabled = false;
    one('#nextBtn').disabled = true;
    one('#nextBtn').textContent = appState.quiz.current === appState.quiz.questions.length - 1
        ? 'Finalizar →'
        : 'Próxima →';

    renderStudyProgress();
}

function selectAnswer(answerIndex) {
    if (appState.quiz.locked || eliminatedAnswerIndexes.has(answerIndex)) return;

    selectedAnswerIndex = answerIndex;
    all('.answer-choice').forEach((option) => {
        option.classList.toggle('is-selected', Number(option.dataset.index) === answerIndex);
    });

    one('#confirmAnswerBtn').disabled = false;
}

function toggleEliminatedAnswer(answerIndex) {
    if (appState.quiz.locked) return;

    if (eliminatedAnswerIndexes.has(answerIndex)) {
        eliminatedAnswerIndexes.delete(answerIndex);
    } else {
        eliminatedAnswerIndexes.add(answerIndex);
        if (selectedAnswerIndex === answerIndex) {
            selectedAnswerIndex = null;
        }
    }

    const eliminated = eliminatedAnswerIndexes.has(answerIndex);
    const row = document.querySelector(`[data-answer-row="${answerIndex}"]`);
    const choice = row?.querySelector('.answer-choice');
    const eliminateButton = row?.querySelector('.answer-eliminate');

    row?.classList.toggle('is-eliminated', eliminated);
    choice?.classList.toggle('is-selected', selectedAnswerIndex === answerIndex);
    if (choice) choice.disabled = eliminated;
    eliminateButton?.classList.toggle('is-active', eliminated);
    eliminateButton?.setAttribute('aria-pressed', String(eliminated));

    one('#confirmAnswerBtn').disabled = selectedAnswerIndex === null;
}

function confirmSelectedAnswer() {
    if (selectedAnswerIndex === null || appState.quiz.locked) return;
    submitAnswer(selectedAnswerIndex);
}

async function submitAnswer(answerIndex) {
    if (appState.quiz.locked) return;

    appState.quiz.locked = true;
    const confirmButton = one('#confirmAnswerBtn');
    confirmButton.disabled = true;
    confirmButton.textContent = 'Confirmando…';

    try {
        await syncSessionActivity({ interaction: true });
        const question = appState.quiz.questions[appState.quiz.current];
        const data = await requestJson('responder', {
            method: 'POST',
            body: JSON.stringify({
                sessao_id: appState.quiz.sessionId,
                questao_id: question.id,
                resposta_marcada: answerIndex,
            }),
        });

        appState.quiz.stats.answered += 1;
        if (data.acertou) appState.quiz.stats.correct += 1;

        // Se a alternativa correta havia sido riscada, ela precisa voltar ao estado
        // normal antes de receber o destaque verde do gabarito.
        const correctIndex = Number(data.correta);
        eliminatedAnswerIndexes.delete(correctIndex);
        const correctRow = document.querySelector(`[data-answer-row="${correctIndex}"]`);
        const correctEliminateButton = correctRow?.querySelector('.answer-eliminate');
        correctRow?.classList.remove('is-eliminated');
        correctEliminateButton?.classList.remove('is-active');
        correctEliminateButton?.setAttribute('aria-pressed', 'false');

        all('.answer-choice').forEach((option, index) => {
            option.disabled = true;

            if (index === correctIndex) {
                option.classList.add('is-correct');
            } else if (index === answerIndex) {
                option.classList.add('is-wrong');
            } else {
                option.classList.add('is-dimmed');
            }
        });

        all('.answer-eliminate').forEach((button) => {
            button.disabled = true;
        });

        one('#skipBtn').disabled = true;
        confirmButton.textContent = 'Resposta confirmada ✓';

        const answerFeedback = one('#answerFeedback');
        answerFeedback.textContent = data.acertou
            ? '✓ Você acertou!'
            : '✕ Você errou. A resposta correta está destacada em verde.';
        answerFeedback.classList.toggle('is-correct', Boolean(data.acertou));
        answerFeedback.classList.toggle('is-wrong', !data.acertou);

        one('#resolutionText').textContent = data.resolucao;
        one('#resolution').classList.remove('hidden');
        one('#nextBtn').disabled = false;
        renderStudyProgress();
    } catch (error) {
        appState.quiz.locked = false;
        confirmButton.disabled = selectedAnswerIndex === null;
        confirmButton.textContent = 'Confirmar resposta';
        if (['TESTE_EXPIRADO', 'ACESSO_VENCIDO', 'ACESSO_QUESTOES_BLOQUEADO'].includes(error.code)) {
            renderAccessBlocked(error);
            return;
        }
        notify(error.message);
    }
}

async function skipCurrentQuestion() {
    if (appState.quiz.locked) return;

    appState.quiz.locked = true;

    try {
        await syncSessionActivity({ interaction: true });
        const question = appState.quiz.questions[appState.quiz.current];

        await requestJson('responder', {
            method: 'POST',
            body: JSON.stringify({
                sessao_id: appState.quiz.sessionId,
                questao_id: question.id,
                pulada: true,
            }),
        });

        appState.quiz.stats.skipped += 1;
        advanceQuestion();
    } catch (error) {
        appState.quiz.locked = false;
        if (['TESTE_EXPIRADO', 'ACESSO_VENCIDO', 'ACESSO_QUESTOES_BLOQUEADO'].includes(error.code)) {
            renderAccessBlocked(error);
            return;
        }
        notify(error.message);
    }
}

function advanceQuestion() {
    if (appState.quiz.current < appState.quiz.questions.length - 1) {
        appState.quiz.current += 1;
        renderCurrentQuestion();
        return;
    }

    finishStudySession();
}

function renderStudyProgress() {
    const completed = ((appState.quiz.current + 1) / appState.quiz.questions.length) * 100;

    one('#quizProgressBar').style.width = `${completed}%`;
    one('#progressText').textContent =
        `${appState.quiz.current + 1} / ${appState.quiz.questions.length}`;
    one('#scoreText').textContent = `${appState.quiz.stats.correct} acertos`;
}

async function finishStudySession() {
    const percentage = appState.quiz.stats.answered
        ? Math.round((appState.quiz.stats.correct / appState.quiz.stats.answered) * 100)
        : 0;

    await requestJson('sessoes', {
        method: 'PUT',
        body: JSON.stringify({
            id: appState.quiz.sessionId,
            respondidas: appState.quiz.stats.answered,
            acertos: appState.quiz.stats.correct,
            puladas: appState.quiz.stats.skipped,
            percentual: percentage,
        }),
    });

    one('#resultScore').textContent =
        `${appState.quiz.stats.correct}/${appState.quiz.questions.length}`;
    one('#resultMessage').textContent =
        `${percentage}% de aproveitamento em ${appState.quiz.stats.answered} ` +
        `questões respondidas. ${appState.quiz.stats.skipped} puladas.`;

    document.dispatchEvent(new CustomEvent('quiz:progress-changed'));
    openScreen('resultView');
}
