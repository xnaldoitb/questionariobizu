import { requestJson } from '../../foundation/request.js';
import { one, safeText, notify } from '../../foundation/selectors.js';
import { appState } from '../../foundation/model.js';
import { accountBadges } from '../../foundation/badges.js';
import {
    adminState,
    closeAdminModal,
    datePlusDays,
    formatDate,
    formatDateTime,
    isSupreme,
    openAdminModal,
    todayInput,
    toDateInput,
} from './common.js';

function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'AL';
}

function roleLabel(profile) {
    if (profile === 'supremo') return 'Desenvolvedor';
    if (profile === 'admin') return 'Administrador';
    return 'Aluno';
}

function statusOf(user) {
    if (user.status_aprovacao === 'negado') return { key: 'negado', label: 'negado' };
    if (!user.ativo && !user.desativado_por_validade) return { key: 'desativado', label: 'desativado' };
    if (user.teste_expirado) return { key: 'teste_expirado', label: user.status_aprovacao === 'pendente' ? 'teste encerrado · pendente' : 'teste encerrado' };
    if (user.teste_ativo) return { key: 'teste', label: user.status_aprovacao === 'pendente' ? 'teste 30 min · pendente' : 'teste 30 min' };
    if (user.teste_disponivel) return { key: 'teste', label: 'teste disponível / pausado' };
    if (user.status_aprovacao === 'pendente') return { key: 'pendente', label: 'aguardando aprovação' };
    if (user.acesso_expirado) return { key: 'expirado', label: 'acesso às questões vencido' };
    return { key: 'ativo', label: 'ativo' };
}

function validityLabel(user) {
    if (user.perfil === 'supremo') return 'Sem controle de validade';
    if (user.vip) return 'VIP · acesso vitalício';
    if (user.acesso_teste) {
        const minutes = Math.ceil(Number(user.acesso_restante_ms || 0) / 60000);
        return minutes > 0 ? `Teste: ${minutes} min restantes de uso ativo` : `Teste encerrado · próximo ciclo ${formatDateTime(user.teste_proximo_em)}`;
    }
    if (!user.validade_ate) return 'Teste encerrado · sem plano';
    return user.acesso_expirado
        ? `Questões vencidas em ${formatDate(user.validade_ate)} · conta ainda acessível`
        : `Válido até ${formatDate(user.validade_ate)}`;
}

function whatsappLabel(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return 'Não informado';
    const local = digits.startsWith('55') ? digits.slice(2) : digits;
    const ddd = local.slice(0, 2);
    const number = local.slice(2);
    return `(${ddd}) ${number.length === 9 ? `${number.slice(0, 5)}-${number.slice(5)}` : `${number.slice(0, 4)}-${number.slice(4)}`}`;
}


function adminName(record, fallback) {
    if (record?.nome) return record.nome;
    return fallback;
}

function canCurrentActorManage(user) {
    return isSupreme() || user.perfil === 'aluno';
}

function renderAdminOptions(select, selectedId = '', { allowEmpty = true } = {}) {
    if (!select) return;

    const options = adminState.administrators.map((admin) => `
        <option value="${admin.id}" ${admin.id === selectedId ? 'selected' : ''}>
            ${safeText(admin.nome)} · ${safeText(roleLabel(admin.perfil))}
        </option>
    `).join('');

    select.innerHTML = `${allowEmpty ? '<option value="">Sem responsável definido</option>' : ''}${options}`;

    if (!allowEmpty && !selectedId && appState.user?.id) {
        select.value = appState.user.id;
    }
}

function renderUserCard(user) {
    const status = statusOf(user);
    const canManage = canCurrentActorManage(user) && user.perfil !== 'supremo';
    const isStudent = user.perfil === 'aluno';

    const approvalButtons = canManage && isStudent && ['pendente', 'negado'].includes(user.status_aprovacao)
        ? `
            <button class="ui-button main-action mini" data-user-command="approve" data-user-id="${user.id}" type="button">Aprovar</button>
            <button class="ui-button quiet-action mini danger" data-user-command="deny" data-user-id="${user.id}" type="button">Negar</button>
        `
        : '';

    const quickActions = canManage
        ? `
            <button class="ui-button quiet-action mini" data-user-command="validity" data-user-id="${user.id}" type="button">Validade</button>
            <button class="ui-button quiet-action mini" data-user-command="edit" data-user-id="${user.id}" type="button">Editar</button>
        `
        : '';

    const menu = canManage
        ? `
            <details class="admin-action-menu">
                <summary>Mais ações</summary>
                <div class="admin-action-menu-popover">
                    ${user.ativo
                        ? `<button data-user-command="deactivate" data-user-id="${user.id}" type="button">Desativar conta</button>`
                        : `<button data-user-command="activate" data-user-id="${user.id}" type="button">Reativar conta</button>`}
                    ${isSupreme() && user.perfil === 'aluno'
                        ? `<button data-user-command="promote_admin" data-user-id="${user.id}" type="button">Tornar administrador</button>`
                        : ''}
                    ${isSupreme() && user.perfil === 'admin'
                        ? `<button data-user-command="demote_admin" data-user-id="${user.id}" type="button">Tornar aluno</button>`
                        : ''}
                    ${isSupreme()
                        ? `<button data-user-command="reset_history" data-user-id="${user.id}" type="button">Resetar histórico / ranking</button>`
                        : ''}
                    <button class="danger-menu-action" data-user-command="delete" data-user-id="${user.id}" type="button">Apagar conta</button>
                </div>
            </details>
        `
        : '<span class="admin-protected-badge">Conta protegida</span>';

    const createdBy = user.criado_por_admin
        ? adminName(user.criado_por_admin, 'Administrador')
        : 'Cadastro próprio / anterior';
    const approvedBy = user.aprovado_por_admin
        ? adminName(user.aprovado_por_admin, 'Administrador')
        : (user.acesso_teste ? 'Ainda não aprovado · acesso de teste' : (user.status_aprovacao === 'aprovado' ? 'Não registrado (cadastro anterior)' : 'Ainda não aprovado'));
    const responsible = user.responsavel_admin
        ? adminName(user.responsavel_admin, 'Administrador')
        : 'Não definido';

    return `
        <article class="admin-user-card admin-user-card-v2 ${user.perfil !== 'aluno' ? 'is-admin' : ''} ${user.vip ? 'is-vip' : ''} ${status.key === 'pendente' ? 'is-pending' : ''} ${['expirado', 'teste_expirado'].includes(status.key) ? 'is-expired' : ''}">
            <div class="admin-user-avatar">${safeText(initials(user.nome))}</div>
            <div class="admin-user-copy">
                <div class="admin-user-name-row">
                    <strong>${safeText(user.nome)} ${accountBadges(user)}</strong>
                    <span class="admin-status-pill status-${status.key}">${safeText(status.label)}</span>
                </div>
                <span>AL SD PM Nº: ${safeText(user.usuario)} · ${safeText(roleLabel(user.perfil))}</span>
                <small><b>WhatsApp:</b> ${user.whatsapp ? `<a href="https://wa.me/${safeText(user.whatsapp)}" target="_blank" rel="noopener noreferrer">${safeText(whatsappLabel(user.whatsapp))}</a>` : 'Não informado'}</small>
                <small>${safeText(validityLabel(user))}</small>
                <small><b>Responsável:</b> ${safeText(responsible)}</small>
                <small>Cadastro: ${safeText(createdBy)} · Aprovação: ${safeText(approvedBy)}</small>
                <small>Último acesso: ${safeText(formatDateTime(user.ultimo_acesso))}</small>
            </div>
            <div class="admin-user-actions">
                ${approvalButtons}
                ${quickActions}
                ${menu}
            </div>
        </article>
    `;
}

function filteredUsers() {
    const search = String(one('#userSearch')?.value || '').trim().toLowerCase();
    const status = one('#userStatusFilter')?.value || 'todos';
    const role = one('#userRoleFilter')?.value || 'todos';
    const responsibility = one('#userResponsibleFilter')?.value || 'todos';

    return adminState.users.filter((user) => {
        const responsible = user.responsavel_admin?.nome || '';
        const matchesSearch = !search || `${user.nome} ${user.usuario} ${user.whatsapp || ''} ${responsible}`.toLowerCase().includes(search);
        const matchesRole = role === 'todos' || user.perfil === role;
        const matchesStatus = status === 'todos' || statusOf(user).key === status;
        const matchesResponsibility = responsibility === 'todos'
            || (responsibility === 'sem_responsavel' && !user.responsavel_admin_id)
            || user.responsavel_admin_id === responsibility;
        return matchesSearch && matchesRole && matchesStatus && matchesResponsibility;
    });
}

export function renderManagedUsers() {
    const list = one('#usersList');
    if (!list) return;

    const users = filteredUsers();
    one('#userListMeta').textContent = `${users.length} de ${adminState.users.length} conta(s)`;
    list.innerHTML = users.length
        ? users.map(renderUserCard).join('')
        : '<div class="admin-empty-state">Nenhuma conta encontrada com estes filtros.</div>';
}

function refreshResponsibleSelectors() {
    const newSelect = one('#newUserResponsible');
    if (newSelect) {
        const previous = newSelect.value || appState.user?.id || '';
        renderAdminOptions(newSelect, previous, { allowEmpty: false });
        if (adminState.administrators.some((admin) => admin.id === previous)) {
            newSelect.value = previous;
        }
    }

    const filter = one('#userResponsibleFilter');
    if (filter) {
        const previous = filter.value || 'todos';
        filter.innerHTML = [
            '<option value="todos">Todos os responsáveis</option>',
            '<option value="sem_responsavel">Sem responsável</option>',
            ...adminState.administrators.map((admin) => (
                `<option value="${safeText(admin.id)}">${safeText(admin.nome)} · ${safeText(roleLabel(admin.perfil))}</option>`
            )),
        ].join('');
        filter.value = [...filter.options].some((option) => option.value === previous) ? previous : 'todos';
    }
}

export async function refreshManagedUsers({ quiet = false } = {}) {
    try {
        const response = await requestJson('admin-users');
        adminState.users = response.usuarios || [];
        adminState.administrators = response.administradores || [];
        refreshResponsibleSelectors();
        renderManagedUsers();
        return adminState.users;
    } catch (error) {
        if (!quiet) notify(error.message);
        one('#userListMeta').textContent = error.message;
        throw error;
    }
}

async function sendUserAction(id, action, extra = {}) {
    return requestJson('admin-users', {
        method: 'PUT',
        body: JSON.stringify({ id, action, ...extra }),
    });
}

function findUser(id) {
    return adminState.users.find((user) => user.id === id);
}

function openUserEdit(id) {
    const user = findUser(id);
    if (!user) return;

    one('#editUserId').value = user.id;
    one('#editUserName').value = user.nome || '';
    one('#editUserLogin').value = user.usuario || '';
    one('#editUserWhatsapp').value = user.whatsapp || '';
    one('#editUserPassword').value = '';

    const responsibleSelect = one('#editUserResponsible');
    renderAdminOptions(responsibleSelect, user.responsavel_admin_id || '', { allowEmpty: true });
    if (responsibleSelect) responsibleSelect.value = user.responsavel_admin_id || '';

    const vipToggle = one('#editUserVip');
    if (vipToggle) vipToggle.checked = Boolean(user.vip);

    one('#userEditTitle').textContent = `Editar ${user.nome}`;
    openAdminModal('userEditModal');
}

function openValidity(id) {
    const user = findUser(id);
    if (!user) return;

    one('#validityUserId').value = user.id;
    one('#validityDate').value = toDateInput(user.validade_ate);
    one('#validityDate').min = todayInput();
    one('#validityUserInfo').textContent = `${user.nome} · ${validityLabel(user)}`;
    one('#validityTitle').textContent = `Prazo de acesso — ${user.nome}`;
    openAdminModal('validityModal');
}

async function handleUserCommand(button) {
    const id = button.dataset.userId;
    const command = button.dataset.userCommand;
    const user = findUser(id);
    if (!user) return;

    if (command === 'edit') return openUserEdit(id);
    if (command === 'validity') return openValidity(id);

    const confirmations = {
        approve: 'Aprovar este cadastro?',
        deny: 'Negar este cadastro e bloquear o acesso?',
        activate: 'Reativar esta conta?',
        deactivate: 'Desativar esta conta? Uma sessão de aluno será encerrada.',
        promote_admin: 'Tornar este aluno administrador?',
        demote_admin: 'Remover os privilégios administrativos desta conta?',
        reset_history: 'Apagar todo o histórico e ranking deste usuário?',
        delete: user.vip
            ? 'Apagar esta conta VIP e todo o histórico dela? Esta ação é definitiva.'
            : 'Apagar esta conta e todo o histórico dela? Esta ação é definitiva.',
    };

    if (confirmations[command] && !confirm(confirmations[command])) return;

    try {
        if (command === 'delete') {
            await requestJson(`admin-users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            notify('Conta apagada.');
        } else if (command === 'activate' || command === 'deactivate') {
            await sendUserAction(id, 'toggle_active', { ativo: command === 'activate' });
            notify(command === 'activate' ? 'Conta reativada.' : 'Conta desativada.');
        } else {
            const result = await sendUserAction(id, command);
            if (command === 'approve' && result.expirado) {
                notify('Cadastro aprovado, mas a validade venceu. Defina um novo prazo para liberar o acesso.', 4800);
            } else {
                notify(command === 'reset_history' ? 'Histórico e ranking resetados.' : 'Conta atualizada.');
            }
        }

        await refreshManagedUsers();
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function createUser(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.vip = Boolean(one('#newUserVip')?.checked);
    if (isSupreme()) {
        data.responsavel_admin_id = one('#newUserResponsible')?.value || null;
    }

    try {
        await requestJson('admin-users', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        event.currentTarget.reset();
        one('#newUserValidity').min = todayInput();
        refreshResponsibleSelectors();
        notify('Usuário cadastrado e aprovado.');
        await refreshManagedUsers();
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function saveUserEdit(event) {
    event.preventDefault();

    const id = one('#editUserId').value;
    const payload = {
        nome: one('#editUserName').value,
        usuario: one('#editUserLogin').value,
        whatsapp: one('#editUserWhatsapp').value,
    };

    payload.vip = Boolean(one('#editUserVip')?.checked);
    if (isSupreme()) {
        if (one('#editUserPassword').value) {
            payload.senha = one('#editUserPassword').value;
        }
        payload.responsavel_admin_id = one('#editUserResponsible')?.value || null;
    }

    try {
        await sendUserAction(id, 'update_user', payload);
        closeAdminModal('userEditModal');
        notify(payload.vip ? 'Usuário atualizado como VIP com acesso vitalício.' : 'Dados do usuário atualizados.');
        await refreshManagedUsers();
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function applyValidity(value, vitalicio = false) {
    const id = one('#validityUserId').value;
    if (!id) return;

    try {
        await sendUserAction(id, 'set_validity', { validade_ate: value || null, vitalicio });
        closeAdminModal('validityModal');
        notify(vitalicio ? 'Acesso vitalício / VIP concedido.' : value ? 'Validade e Premium atualizados.' : 'Teste encerrado. Novo ciclo disponível em 8h.');
        await refreshManagedUsers();
    } catch (error) {
        notify(error.message, 4200);
    }
}

export function bindUserManagement() {
    one('#refreshUsers')?.addEventListener('click', () => refreshManagedUsers());
    one('#userForm')?.addEventListener('submit', createUser);
    one('#userEditForm')?.addEventListener('submit', saveUserEdit);
    one('#validityForm')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = one('#validityDate').value;
        if (!value) {
            notify('Escolha uma data ou use “Sem prazo”.');
            return;
        }
        applyValidity(value);
    });
    one('#removeValidityBtn')?.addEventListener('click', () => {
        if (confirm('Encerrar o acesso atual? “Sem prazo” remove Premium/VIP e deixa o teste encerrado, com novo ciclo em 8h.')) {
            applyValidity(null);
        }
    });

    one('#permanentValidityBtn')?.addEventListener('click', () => {
        if (confirm('Conceder acesso vitalício e marcar esta conta como VIP?')) applyValidity(null, true);
    });

    one('#userSearch')?.addEventListener('input', renderManagedUsers);
    one('#userStatusFilter')?.addEventListener('change', renderManagedUsers);
    one('#userRoleFilter')?.addEventListener('change', renderManagedUsers);
    one('#userResponsibleFilter')?.addEventListener('change', renderManagedUsers);

    one('#usersList')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-user-command]');
        if (button) handleUserCommand(button);
    });

    document.querySelectorAll('[data-validity-days]').forEach((button) => {
        button.addEventListener('click', () => {
            one('#validityDate').value = datePlusDays(button.dataset.validityDays);
        });
    });

    one('#newUserValidity').min = todayInput();
    one('#validityDate').min = todayInput();
}
