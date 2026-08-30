import { one, all, notify } from '../foundation/selectors.js';
import { appState } from '../foundation/model.js';
import { refreshCatalog } from './catalog.js';
import { bindAdminModalClosers, isManager, isSupreme } from './admin/common.js';
import { bindUserManagement, refreshManagedUsers } from './admin/users.js';
import {
    bindContentManagement,
    refreshAdminCatalog,
    renderManagedCatalog,
} from './admin/content.js';
import { bindQuestionManagement, refreshAdminQuestions } from './admin/questions.js';
import { bindTransferManagement } from './admin/transfer.js';
import { bindMaintenanceManagement } from './admin/maintenance.js';
import { refreshAdminOverview } from './admin/overview.js';
import { bindPaymentManagement, refreshAdminPayments } from './admin/payments.js';

const ADMIN_PANELS = [
    'overviewPanel',
    'usersPanel',
    'paymentsPanel',
    'contentPanel',
    'questionsPanel',
    'transferPanel',
    'maintenancePanel',
];

let currentPanel = 'overviewPanel';

function panelAllowed(panelId) {
    if (!isManager()) return false;
    if (['overviewPanel', 'usersPanel', 'paymentsPanel'].includes(panelId)) return true;
    return isSupreme();
}

async function loadPanel(panelId) {
    if (panelId === 'overviewPanel') {
        await refreshAdminOverview();
        return;
    }

    if (panelId === 'usersPanel') {
        await refreshManagedUsers();
        return;
    }

    if (panelId === 'paymentsPanel') {
        await refreshAdminPayments();
        return;
    }

    if (panelId === 'contentPanel') {
        await refreshAdminCatalog();
        return;
    }

    if (panelId === 'questionsPanel') {
        await refreshAdminCatalog({ quiet: true });
        await refreshAdminQuestions({ page: 1 });
        return;
    }

    if (panelId === 'transferPanel') {
        await Promise.all([
            refreshCatalog(),
            refreshAdminCatalog({ quiet: true }),
        ]);
        return;
    }

    if (panelId === 'maintenancePanel') {
        await refreshAdminCatalog();
    }
}

export async function activateAdminPanel(panelId, { load = true } = {}) {
    if (!panelAllowed(panelId)) {
        notify('Esta área é permitida somente ao Desenvolvedor.');
        return;
    }

    currentPanel = panelId;

    all('.admin-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.admin === panelId);
    });

    ADMIN_PANELS.forEach((id) => {
        one(`#${id}`)?.classList.toggle('hidden', id !== panelId);
    });

    if (load) {
        try {
            await loadPanel(panelId);
        } catch {
            // Cada módulo já exibe a mensagem apropriada ao usuário.
        }
    }
}

export function applyManagementAccess() {
    const supreme = isSupreme();
    const manager = isManager();

    one('#navAdmin')?.classList.toggle('hidden', !manager);
    all('.supreme-only').forEach((element) => element.classList.toggle('hidden', !supreme));

    // Preparar a interface de alunos não é uma tentativa de abrir o painel.
    if (!manager) {
        currentPanel = 'overviewPanel';
        one('#adminView')?.classList.add('hidden');
        ADMIN_PANELS.forEach((id) => one(`#${id}`)?.classList.add('hidden'));
        return;
    }

    const roleSelect = one('#newUserRole');
    if (roleSelect) {
        roleSelect.innerHTML = supreme
            ? '<option value="aluno">Aluno</option><option value="admin">Administrador</option>'
            : '<option value="aluno">Aluno</option>';
    }

    const intro = one('#adminPermissionInfo');
    if (intro) {
        intro.textContent = supreme
            ? 'Desenvolvedor: usuários, planos, pagamentos, conteúdo, questões, backup e manutenção.'
            : 'ADM vendedor: você tem controle sobre usuários sob sua responsabilidade e usuários ainda sem responsável definido, incluindo contas em teste, vencidas e VIP. Pode aprovar, alterar validade, conceder ou remover VIP e excluir seus usuários. Ao realizar a primeira ação, o usuário passa a ficar sob sua responsabilidade.';
    }

    if (!supreme && !['overviewPanel', 'usersPanel', 'paymentsPanel'].includes(currentPanel)) {
        currentPanel = 'overviewPanel';
    }

    activateAdminPanel(currentPanel, { load: false });
}

export function bindManagementEvents() {
    bindAdminModalClosers();
    bindUserManagement();
    bindPaymentManagement();
    bindContentManagement();
    bindQuestionManagement();
    bindTransferManagement();
    bindMaintenanceManagement();

    all('.admin-tab').forEach((button) => {
        button.addEventListener('click', () => activateAdminPanel(button.dataset.admin));
    });

    all('[data-admin-jump]').forEach((button) => {
        button.addEventListener('click', () => activateAdminPanel(button.dataset.adminJump));
    });

    one('#adminRefreshCurrent')?.addEventListener('click', () => activateAdminPanel(currentPanel));
}

export async function openManagementWorkspace() {
    if (!isManager()) return;
    applyManagementAccess();
    await activateAdminPanel(currentPanel);
}

export { refreshManagedUsers, renderManagedCatalog };
