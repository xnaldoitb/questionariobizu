import { requestJson } from '../../foundation/request.js';
import { one, safeText, notify } from '../../foundation/selectors.js';
import { appState } from '../../foundation/model.js';
import { adminState, formatDate, formatDateTime, isSupreme } from './common.js';
import { refreshManagedUsers } from './users.js';

const CANCELLED = new Set(['cancelled', 'canceled', 'rejected', 'refunded', 'charged_back', 'erro', 'revisao']);

function money(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function statusGroup(status) {
    if (status === 'approved') return 'approved';
    if (CANCELLED.has(status)) return 'cancelado';
    return 'pendente';
}

function statusLabel(payment) {
    if (payment.origem === 'manual') return 'Liberação manual';
    const labels = {
        approved: 'Aprovado', pending: 'Pendente', in_process: 'Em processamento',
        rejected: 'Recusado', cancelled: 'Cancelado', canceled: 'Cancelado',
        refunded: 'Estornado', charged_back: 'Contestado', erro: 'Erro', revisao: 'Em revisão',
    };
    return labels[payment.status] || payment.status || 'Desconhecido';
}

function planAccessLabel(plan) {
    return plan.acesso_permanente ? 'Acesso permanente' : `${Number(plan.duracao_dias)} dias`;
}

function visibleUsers() {
    return adminState.users.filter((user) =>
        user.perfil === 'aluno' &&
        (isSupreme() || user.responsavel_admin_id === appState.user?.id || !user.responsavel_admin_id)
    );
}

function fillUserSelect() {
    const select = one('#paymentUserSelect');
    if (!select) return;
    const previous = select.value;
    const users = visibleUsers();
    select.innerHTML = users.length
        ? users.map((user) => `<option value="${user.id}">${safeText(user.nome)} · AL ${safeText(user.usuario)} · vence ${safeText(user.vip ? 'permanente' : formatDate(user.validade_ate, 'sem prazo'))}</option>`).join('')
        : '<option value="">Nenhum usuário disponível</option>';
    if (users.some((user) => user.id === previous)) select.value = previous;
}

function fillPlanSelect() {
    const select = one('#paymentPlanSelect');
    if (!select) return;
    const active = adminState.plans.filter((plan) => plan.ativo);
    select.innerHTML = active.map((plan) => `<option value="${safeText(plan.id)}">${safeText(plan.nome)} · ${safeText(money(plan.preco))} · ${safeText(planAccessLabel(plan))}</option>`).join('');
}

function renderPlans() {
    const list = one('#adminPlanList');
    if (!list) return;
    list.innerHTML = adminState.plans.length ? adminState.plans.map((plan) => `
        <article class="admin-plan-card ${plan.ativo ? '' : 'is-inactive'}">
            <div><strong>${safeText(plan.nome)}</strong><span>${safeText(money(plan.preco))} · ${safeText(planAccessLabel(plan))}</span><small>${plan.ativo ? 'Disponível no checkout' : 'Plano desativado'}</small></div>
            ${isSupreme() ? `<div class="data-actions"><button class="ui-button quiet-action mini" data-plan-action="edit" data-plan-id="${safeText(plan.id)}" type="button">Editar</button><button class="ui-button quiet-action mini" data-plan-action="toggle" data-plan-id="${safeText(plan.id)}" type="button">${plan.ativo ? 'Desativar' : 'Ativar'}</button></div>` : ''}
        </article>
    `).join('') : '<div class="admin-empty-state">Nenhum plano cadastrado.</div>';
    fillPlanSelect();
}

function filteredPayments() {
    const search = String(one('#paymentSearch')?.value || '').trim().toLowerCase();
    const status = one('#paymentStatusFilter')?.value || 'todos';
    return adminState.payments.filter((payment) => {
        const user = payment.usuario || {};
        const text = `${user.nome || ''} ${user.usuario || ''} ${user.whatsapp || ''} ${payment.plano_nome || payment.plano || ''}`.toLowerCase();
        return (!search || text.includes(search)) &&
            (status === 'todos' || statusGroup(payment.status) === status);
    });
}

function renderPaymentStats() {
    const counts = { pendente: 0, approved: 0, cancelado: 0 };
    adminState.payments.forEach((payment) => { counts[statusGroup(payment.status)] += 1; });
    one('#paymentStatPending').textContent = counts.pendente;
    one('#paymentStatApproved').textContent = counts.approved;
    one('#paymentStatCancelled').textContent = counts.cancelado;
}

function renderPayments() {
    const list = one('#paymentHistoryList');
    if (!list) return;
    const payments = filteredPayments();
    one('#paymentListMeta').textContent = `${payments.length} de ${adminState.payments.length} registro(s)`;
    list.innerHTML = payments.length ? payments.map((payment) => {
        const user = payment.usuario || {};
        const status = statusGroup(payment.status);
        return `<article class="admin-payment-card status-${status}">
            <div class="admin-payment-main"><strong>${safeText(user.nome || 'Usuário removido')}</strong><span>AL ${safeText(user.usuario || '—')} · ${safeText(user.whatsapp || 'WhatsApp não informado')}</span><small>${safeText(payment.plano_nome || payment.plano)} · ${payment.origem === 'manual' ? 'Sem cobrança' : safeText(money(payment.valor))} · ${safeText(formatDateTime(payment.criado_em))}</small><small>Vencimento atual: ${safeText(user.vip ? 'permanente' : formatDate(user.validade_ate, 'sem prazo'))}</small></div>
            <span class="admin-status-pill status-${status}">${safeText(statusLabel(payment))}</span>
            ${user.id && payment.plano ? `<button class="ui-button quiet-action mini" data-payment-action="regenerate" data-user-id="${safeText(user.id)}" data-plan-id="${safeText(payment.plano)}" type="button">Reenviar / nova cobrança</button>` : ''}
        </article>`;
    }).join('') : '<div class="admin-empty-state">Nenhum pagamento encontrado.</div>';
    renderPaymentStats();
}

export async function refreshAdminPayments({ quiet = false } = {}) {
    try {
        if (!adminState.users.length) await refreshManagedUsers({ quiet: true });
        const data = await requestJson('admin-payments');
        adminState.plans = data.planos || [];
        adminState.payments = data.pagamentos || [];
        renderPlans();
        fillUserSelect();
        renderPayments();
    } catch (error) {
        one('#paymentListMeta').textContent = error.message;
        if (!quiet) notify(error.message, 4500);
        throw error;
    }
}

function resetPlanForm() {
    one('#planForm')?.reset();
    one('#planEditId').value = '';
    one('#planOrder').value = '0';
    one('#planDays').disabled = false;
    one('#planDays').required = true;
}

async function savePlan(event) {
    event.preventDefault();
    const permanent = Boolean(one('#planPermanent').checked);
    try {
        await requestJson('admin-payments', { method: 'POST', body: JSON.stringify({
            action: 'save_plan', id: one('#planEditId').value || undefined,
            nome: one('#planName').value, preco: one('#planPrice').value,
            duracao_dias: permanent ? null : Number(one('#planDays').value),
            acesso_permanente: permanent, ordem: Number(one('#planOrder').value || 0), ativo: true,
        }) });
        resetPlanForm();
        notify('Plano salvo. O checkout foi atualizado automaticamente.');
        await refreshAdminPayments({ quiet: true });
    } catch (error) { notify(error.message, 4500); }
}

async function planAction(button) {
    const plan = adminState.plans.find((item) => item.id === button.dataset.planId);
    if (!plan) return;
    if (button.dataset.planAction === 'edit') {
        one('#planEditId').value = plan.id;
        one('#planName').value = plan.nome;
        one('#planPrice').value = plan.preco;
        one('#planDays').value = plan.duracao_dias || '';
        one('#planOrder').value = plan.ordem || 0;
        one('#planPermanent').checked = Boolean(plan.acesso_permanente);
        one('#planDays').disabled = Boolean(plan.acesso_permanente);
        one('#planDays').required = !plan.acesso_permanente;
        one('#planEditorBox').open = true;
        one('#planName').focus();
        return;
    }
    try {
        await requestJson('admin-payments', { method: 'POST', body: JSON.stringify({ action: 'toggle_plan', id: plan.id, ativo: !plan.ativo }) });
        notify(plan.ativo ? 'Plano desativado.' : 'Plano ativado.');
        await refreshAdminPayments({ quiet: true });
    } catch (error) { notify(error.message, 4500); }
}

async function adminPaymentAction(action, userId = one('#paymentUserSelect')?.value, planId = one('#paymentPlanSelect')?.value) {
    if (!userId || !planId) return notify('Selecione um usuário e um plano.');
    if (action === 'manual_grant' && !confirm('Liberar este plano manualmente? O período será somado à validade atual.')) return;
    const status = one('#paymentActionStatus');
    status.textContent = action === 'manual_grant' ? 'Liberando acesso…' : 'Gerando cobrança…';
    try {
        const result = await requestJson('admin-payments', { method: 'POST', body: JSON.stringify({ action, usuario_id: userId, plano_id: planId }) });
        if (action === 'manual_grant') {
            status.textContent = 'Acesso liberado com sucesso.';
            notify('Acesso liberado. A renovação foi acumulada quando havia validade ativa.');
        } else {
            await navigator.clipboard?.writeText(result.checkout_url).catch(() => {});
            status.innerHTML = `Cobrança criada. <a href="${safeText(result.checkout_url)}" target="_blank" rel="noopener noreferrer">Abrir pagamento</a>`;
            if (result.whatsapp) {
                const message = encodeURIComponent(`Olá, ${result.usuario_nome}. Sua cobrança do Questionário Bizu está disponível aqui: ${result.checkout_url}`);
                window.open(`https://wa.me/${result.whatsapp}?text=${message}`, '_blank', 'noopener,noreferrer');
            } else {
                window.open(result.checkout_url, '_blank', 'noopener,noreferrer');
            }
            notify('Nova cobrança gerada. O link também foi copiado.');
        }
        await refreshManagedUsers({ quiet: true });
        await refreshAdminPayments({ quiet: true });
    } catch (error) { status.textContent = error.message; notify(error.message, 4500); }
}

export function bindPaymentManagement() {
    one('#refreshPayments')?.addEventListener('click', () => refreshAdminPayments());
    one('#planForm')?.addEventListener('submit', savePlan);
    one('#planCancelEdit')?.addEventListener('click', resetPlanForm);
    one('#planPermanent')?.addEventListener('change', (event) => {
        one('#planDays').disabled = event.target.checked;
        one('#planDays').required = !event.target.checked;
        if (event.target.checked) one('#planDays').value = '';
    });
    one('#adminPlanList')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-plan-action]'); if (button) planAction(button);
    });
    one('#paymentSearch')?.addEventListener('input', renderPayments);
    one('#paymentStatusFilter')?.addEventListener('change', renderPayments);
    one('#manualGrantBtn')?.addEventListener('click', () => adminPaymentAction('manual_grant'));
    one('#generateChargeBtn')?.addEventListener('click', () => adminPaymentAction('generate_charge'));
    one('#paymentHistoryList')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-payment-action="regenerate"]');
        if (button) adminPaymentAction('generate_charge', button.dataset.userId, button.dataset.planId);
    });
}
