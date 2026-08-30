import { requestJson } from '../foundation/request.js';
import { one, safeText } from '../foundation/selectors.js';
import { appState } from '../foundation/model.js';
import { openScreen } from '../foundation/navigation.js';
import { startSessionActivity, syncSessionActivity, sessionIsActive } from './session-activity.js';

let countdownTimer = null;
let paymentPollingTimer = null;
let paymentCheckRunning = false;
let paymentCreating = false;
let accessReceivedAt = Date.now();
let lastPaymentCheck = 0;

function canShowStudentPlans() {
    const user = appState.user;
    return user?.perfil === 'aluno' && !user.vip && user.acesso_tipo !== 'vitalicio' && user.acesso_codigo !== 'ACESSO_VITALICIO';
}

function acceptUser(user) {
    if (!user) return;
    appState.user = user;
    accessReceivedAt = Date.now();
    renderAccessNotice();
    if (user.acesso_questoes && !one('#accessBlockedCard')?.classList.contains('hidden') && !one('#quizView')?.classList.contains('hidden')) {
        one('#accessBlockedCard')?.classList.add('hidden');
        openScreen('dashboard');
    }
    document.dispatchEvent(new CustomEvent('quiz:access-changed'));
}

function startPaymentPolling() {
    if (paymentPollingTimer) clearInterval(paymentPollingTimer);
    paymentPollingTimer = window.setInterval(() => {
        if (appState.user && document.visibilityState === 'visible') checkPaymentStatus();
    }, 30000);
    checkPaymentStatus();
}

function formatRemaining(milliseconds) {
    const totalSeconds = Math.max(Math.ceil(Number(milliseconds || 0) / 1000), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function trialRemaining(user) {
    const elapsed = user?.acesso_codigo === 'TESTE_ATIVO' && sessionIsActive() ? Date.now() - accessReceivedAt : 0;
    return Math.max(Number(user?.acesso_restante_ms || 0) - elapsed, 0);
}

function expiredAccessMessage(user) {
    if (user?.acesso_codigo === 'TESTE_EXPIRADO' || user?.acesso_teste) {
        const next = user?.teste_proximo_em ? new Date(user.teste_proximo_em).toLocaleString('pt-BR') : 'no próximo acesso ativo';
        return `Teste encerrado. Próximo ciclo: ${next}. Escolha um plano para continuar sem o limite do teste.`;
    }

    return 'Seu período de acesso às questões venceu. Escolha um plano e pague com Pix para renovar automaticamente.';
}

function money(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

async function loadPaymentPlans() {
    const container = one('#paymentPlans');
    if (!container) return;
    container.innerHTML = '<div class="admin-empty-state">Carregando planos…</div>';
    try {
        const data = await requestJson('planos');
        const plans = data.planos || [];
        container.innerHTML = plans.length ? plans.map((plan) => `
            <article class="payment-plan">
                <strong>${safeText(plan.nome)}</strong>
                <span class="payment-plan-price">${safeText(money(plan.preco))}</span>
                <small>${plan.acesso_permanente ? 'Acesso permanente às questões.' : `${Number(plan.duracao_dias)} dias de acesso às questões.`}</small>
                <button class="ui-button main-action payment-plan-button" data-plan="${safeText(plan.id)}" type="button">Comprar plano</button>
            </article>
        `).join('') : '<div class="admin-empty-state">Nenhum plano disponível no momento.</div>';
    } catch (error) {
        container.innerHTML = `<div class="admin-empty-state">${safeText(error.message)}</div>`;
    }
}

export function openPaymentPlans() {
    if (!canShowStudentPlans()) return;
    one('#paymentStatus')?.classList.add('hidden');
    one('#paymentModal')?.classList.remove('hidden');
    loadPaymentPlans();
    startPaymentPolling();
}

function closePaymentPlans() {
    one('#paymentModal')?.classList.add('hidden');
}

function setPaymentStatus(message, success = false) {
    const status = one('#paymentStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('hidden', 'success-message');
    status.classList.toggle('success-message', success);
}

async function checkPaymentStatus() {
    if (!appState.user || paymentCheckRunning || Date.now() - lastPaymentCheck < 5000) return;
    lastPaymentCheck = Date.now();
    paymentCheckRunning = true;
    try {
        const data = await requestJson('pagamento-status');
        acceptUser(data.usuario);
        const banner = one('#automaticPaymentNotice');
        if (banner) {
            banner.classList.toggle('hidden', !data.pendencias && !data.consulta?.falhas);
            banner.textContent = data.consulta?.falhas
                ? 'Não foi possível conferir todos os pagamentos agora. Tentaremos automaticamente; não pague novamente.'
                : `${data.pendencias} cobrança(s) sem confirmação. Se você já pagou, aguarde: a consulta é automática e não é necessário comprar outra vez.`;
        }
        if (data.consulta?.confirmados > 0) {
            setPaymentStatus('Pagamento confirmado. O acesso foi atualizado; liberações já compensadas manualmente não acrescentam dias novamente.', true);
            return;
        }
        if (data.consulta?.falhas) {
            setPaymentStatus('Não foi possível consultar todas as cobranças. Tentaremos novamente; não é necessário pagar outra vez.');
        } else if (data.pendencias > 0) {
            setPaymentStatus('Há cobranças ainda sem confirmação. Consultando automaticamente; abrir esta tela não gera nova cobrança.');
        } else {
            const confirmed = data.pagamento?.status === 'approved' && data.pagamento?.aplicado_em;
            setPaymentStatus(confirmed ? 'Último pagamento confirmado. Você pode escolher um plano para uma nova compra.' : 'Nenhuma cobrança pendente. Escolha um plano somente se desejar fazer uma nova compra.', Boolean(confirmed));
        }
    } catch {
        setPaymentStatus('Ainda não foi possível confirmar. Continuaremos verificando automaticamente.');
        const banner = one('#automaticPaymentNotice');
        if (banner) { banner.classList.remove('hidden'); banner.textContent = 'Consulta de pagamentos indisponível no momento. Tentaremos automaticamente; seu acesso atual não será removido por esta falha.'; }
    } finally {
        paymentCheckRunning = false;
    }
}

async function beginPayment(plan, button) {
    if (paymentCreating || !canShowStudentPlans()) return;
    paymentCreating = true;
    const checkoutWindow = window.open('', '_blank');
    if (checkoutWindow) checkoutWindow.opener = null;
    button.disabled = true;
    setPaymentStatus('Preparando o pagamento Pix…');
    try {
        const data = await requestJson('pagamento-criar', {
            method: 'POST',
            body: JSON.stringify({ plano: plan }),
        });
        if (checkoutWindow) checkoutWindow.location.href = data.checkout_url;
        else window.location.href = data.checkout_url;
        setPaymentStatus('Pagamento aberto. Após pagar o Pix, a liberação ocorrerá automaticamente.');
        startPaymentPolling();
    } catch (error) {
        checkoutWindow?.close();
        setPaymentStatus(error.message);
    } finally {
        paymentCreating = false;
        button.disabled = false;
    }
}

export function bindPaymentEvents() {
    one('#accountPlansBtn')?.addEventListener('click', openPaymentPlans);
    one('#accessNoticePlans')?.addEventListener('click', openPaymentPlans);
    one('#blockedPlansBtn')?.addEventListener('click', openPaymentPlans);
    one('#paymentClose')?.addEventListener('click', closePaymentPlans);
    one('#paymentModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'paymentModal') closePaymentPlans();
    });
    one('#paymentPlans')?.addEventListener('click', (event) => {
        const button = event.target.closest('.payment-plan-button');
        if (button) beginPayment(button.dataset.plan, button);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkPaymentStatus();
    });
}

export function renderAccessNotice() {
    const showPlans = canShowStudentPlans();
    for (const id of ['accountPlanControls', 'accountPlansBtn', 'accessNoticePlans', 'blockedPlansBtn']) {
        one(`#${id}`)?.classList.toggle('hidden', !showPlans);
    }
    if (!showPlans) closePaymentPlans();
    const notice = one('#accessNotice');
    if (!notice || !appState.user) return;

    const title = one('#accessNoticeTitle');
    const text = one('#accessNoticeText');
    notice.classList.remove('hidden', 'is-trial', 'is-blocked', 'is-active');

    const noticeIcon = notice.querySelector('.access-notice-icon');
    if (appState.user.acesso_teste) {
        if (noticeIcon) noticeIcon.textContent = '⏱';
        const remaining = trialRemaining(appState.user);
        if (remaining > 0) {
            notice.classList.add('is-trial');
            title.textContent = `Teste ${sessionIsActive() ? 'disponível' : 'pausado'} · ${formatRemaining(remaining)} restantes`;
            text.textContent = '30 minutos de uso ativo por ciclo de 8h. Pausa ao sair, ocultar a página ou ficar 2 minutos sem interação. O teste não acumula entre ciclos.';
        } else {
            notice.classList.add('is-blocked');
            title.textContent = 'Teste gratuito encerrado';
            text.textContent = expiredAccessMessage(appState.user);
        }
        return;
    }

    if (appState.user.acesso_questoes === false) {
        if (noticeIcon) noticeIcon.textContent = '🔒';
        notice.classList.add('is-blocked');
        title.textContent = 'Acesso às questões vencido';
        text.textContent = expiredAccessMessage(appState.user);
        return;
    }

    // Contas com acesso regular não precisam ocupar espaço na tela inicial.
    notice.classList.add('hidden');
}

export function startAccessIndicator() {
    if (countdownTimer) clearInterval(countdownTimer);
    renderAccessNotice();
    startSessionActivity(acceptUser);
    startPaymentPolling();
    if (new URLSearchParams(window.location.search).has('pagamento')) {
        openPaymentPlans();
        window.history.replaceState({}, '', window.location.pathname);
    }
    countdownTimer = window.setInterval(() => {
        if (!appState.user) return;
        if (appState.user.acesso_teste) renderAccessNotice();
    }, 1000);
}

export async function refreshAccessState() {
    await syncSessionActivity({ interaction: true });
    const data = await requestJson('me');
    acceptUser(data.usuario);
    return appState.user;
}

export function prepareQuestionView() {
    one('#accessBlockedCard')?.classList.add('hidden');
    one('#questionCard')?.classList.remove('hidden');
}

export function renderAccessBlocked(source = {}) {
    const access = source?.payload?.acesso || source?.acesso || source;
    const code = source?.code || source?.payload?.codigo || access?.codigo || appState.user?.acesso_codigo;
    const message = source?.message || source?.payload?.erro || access?.mensagem || appState.user?.acesso_mensagem;

    if (appState.user) {
        appState.user.acesso_questoes = false;
        appState.user.acesso_codigo = code || 'ACESSO_QUESTOES_BLOQUEADO';
        appState.user.acesso_mensagem = message || expiredAccessMessage(appState.user);
    }

    const isTrial = code === 'TESTE_EXPIRADO' || appState.user?.acesso_teste;
    one('#accessBlockedIcon').textContent = isTrial ? '⏱' : '🔒';
    one('#accessBlockedTitle').textContent = isTrial
        ? 'Seu teste de 30 minutos terminou'
        : 'Seu acesso às questões venceu';
    one('#accessBlockedText').textContent = message || expiredAccessMessage(appState.user);
    one('#questionCard')?.classList.add('hidden');
    one('#accessBlockedCard')?.classList.remove('hidden');
    renderAccessNotice();
    openScreen('quizView');
}

export function accessContactDescription() {
    return safeText('Escolha um plano e pague com Pix para liberar ou renovar o acesso automaticamente.');
}
