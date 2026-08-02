import { api } from '../core/api.js';
import { $, $$, escapeHtml, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { showView } from '../core/views.js';

function resetQuizState() {
    state.quiz.current = 0;
    state.quiz.stats = {
        answered: 0,
        correct: 0,
        skipped: 0
    };
}

export function bindQuizEvents() {
    $('#startBtn').addEventListener('click', startQuiz);
    $('#skipBtn').addEventListener('click', skipQuestion);
    $('#nextBtn').addEventListener('click', nextQuestion);

    $('#backBtn').addEventListener('click', () => {
        if (window.confirm('Sair do simulado atual?')) {
            showView('dashboard');
        }
    });

    $('#restartBtn').addEventListener('click', () => showView('dashboard'));
}

async function startQuiz() {
    try {
        const disciplineId = $('#subjectSelect').value;
        const chapterId = $('#chapterSelect').value;
        const limit = Number($('#limitSelect').value);

        const data = await api(
            `questoes?disciplina=${encodeURIComponent(disciplineId)}` +
            `&capitulo=${encodeURIComponent(chapterId)}` +
            `&limite=${limit}`
        );

        state.quiz.questions = data.questoes.slice(0, limit);

        if (!state.quiz.questions.length) {
            throw new Error('Nenhuma questão encontrada nesse filtro.');
        }

        const sessionData = await api('sessoes', {
            method: 'POST',
            body: JSON.stringify({
                disciplina_id: disciplineId,
                capitulo_id: chapterId || null,
                total: state.quiz.questions.length
            })
        });

        state.quiz.sessionId = sessionData.sessao.id;
        resetQuizState();
        showView('quizView');
        renderQuestion();
    } catch (error) {
        toast(error.message);
    }
}

function renderQuestion() {
    state.quiz.locked = false;

    const question = state.quiz.questions[state.quiz.current];
    const chapter = state.catalog.capitulos.find(
        (item) => item.id === question.capitulo_id
    );

    $('#questionChapter').textContent = chapter?.nome || '';
    $('#questionNumber').textContent =
        `Questão ${state.quiz.current + 1} de ${state.quiz.questions.length}`;
    $('#questionText').textContent = question.enunciado;
    $('#resolution').classList.add('hidden');

    $('#options').innerHTML = question.alternativas.map((option, index) => `
        <button class="option" data-index="${index}">
            <span class="letter">${'ABCDE'[index]}</span>
            <span>${escapeHtml(option)}</span>
        </button>
    `).join('');

    $$('.option').forEach((option) => {
        option.addEventListener('click', () => {
            answerQuestion(Number(option.dataset.index));
        });
    });

    $('#nextBtn').disabled = true;
    $('#nextBtn').textContent = state.quiz.current === state.quiz.questions.length - 1
        ? 'Finalizar →'
        : 'Próxima →';

    updateProgress();
}

async function answerQuestion(answerIndex) {
    if (state.quiz.locked) {
        return;
    }

    state.quiz.locked = true;

    try {
        const question = state.quiz.questions[state.quiz.current];
        const data = await api('responder', {
            method: 'POST',
            body: JSON.stringify({
                sessao_id: state.quiz.sessionId,
                questao_id: question.id,
                resposta_marcada: answerIndex
            })
        });

        state.quiz.stats.answered += 1;
        if (data.acertou) {
            state.quiz.stats.correct += 1;
        }

        $$('.option').forEach((option, index) => {
            option.disabled = true;

            if (index === data.correta) {
                option.classList.add('correct');
            } else if (index === answerIndex) {
                option.classList.add('wrong');
            } else {
                option.classList.add('dim');
            }
        });

        $('#resolutionText').textContent = data.resolucao;
        $('#resolution').classList.remove('hidden');
        $('#nextBtn').disabled = false;
        updateProgress();
    } catch (error) {
        state.quiz.locked = false;
        toast(error.message);
    }
}

async function skipQuestion() {
    if (state.quiz.locked) {
        return;
    }

    state.quiz.locked = true;

    try {
        const question = state.quiz.questions[state.quiz.current];

        await api('responder', {
            method: 'POST',
            body: JSON.stringify({
                sessao_id: state.quiz.sessionId,
                questao_id: question.id,
                pulada: true
            })
        });

        state.quiz.stats.skipped += 1;
        nextQuestion();
    } catch (error) {
        state.quiz.locked = false;
        toast(error.message);
    }
}

function nextQuestion() {
    if (state.quiz.current < state.quiz.questions.length - 1) {
        state.quiz.current += 1;
        renderQuestion();
        return;
    }

    finishQuiz();
}

function updateProgress() {
    const completed = ((state.quiz.current + 1) / state.quiz.questions.length) * 100;

    $('#progressFill').style.width = `${completed}%`;
    $('#progressText').textContent =
        `${state.quiz.current + 1} / ${state.quiz.questions.length}`;
    $('#scoreText').textContent = `${state.quiz.stats.correct} acertos`;
}

async function finishQuiz() {
    const percentage = state.quiz.stats.answered
        ? Math.round((state.quiz.stats.correct / state.quiz.stats.answered) * 100)
        : 0;

    await api('sessoes', {
        method: 'PUT',
        body: JSON.stringify({
            id: state.quiz.sessionId,
            respondidas: state.quiz.stats.answered,
            acertos: state.quiz.stats.correct,
            puladas: state.quiz.stats.skipped,
            percentual: percentage
        })
    });

    $('#resultScore').textContent =
        `${state.quiz.stats.correct}/${state.quiz.questions.length}`;
    $('#resultMessage').textContent =
        `${percentage}% de aproveitamento em ${state.quiz.stats.answered} ` +
        `questões respondidas. ${state.quiz.stats.skipped} puladas.`;

    showView('resultView');
}
