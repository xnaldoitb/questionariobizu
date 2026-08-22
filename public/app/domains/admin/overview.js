import { one, notify } from '../../foundation/selectors.js';
import { adminState, isSupreme } from './common.js';
import { refreshManagedUsers } from './users.js';
import { refreshAdminCatalog } from './content.js';

function setText(selector, value) {
    const element = one(selector);
    if (element) element.textContent = String(value);
}

export async function refreshAdminOverview({ quiet = false } = {}) {
    try {
        await refreshManagedUsers({ quiet: true });

        if (isSupreme()) {
            await refreshAdminCatalog({ quiet: true });
        }

        const users = adminState.users;
        const activeUsers = users.filter((user) => user.ativo && user.status_aprovacao === 'aprovado' && !user.acesso_expirado).length;
        const pending = users.filter((user) => user.status_aprovacao === 'pendente').length;
        const expired = users.filter((user) => user.acesso_expirado).length;

        setText('#adminStatUsers', users.length);
        setText('#adminStatActiveUsers', `${activeUsers} ativos`);
        setText('#adminStatPending', pending);
        setText('#adminStatExpired', expired);

        if (isSupreme()) {
            const disciplines = adminState.catalog.disciplinas;
            const chapters = adminState.catalog.capitulos;
            const totalQuestions = disciplines.reduce((sum, item) => sum + Number(item.questoes_total || 0), 0);
            const activeQuestions = disciplines.reduce((sum, item) => sum + Number(item.questoes_ativas || 0), 0);

            setText('#adminStatDisciplines', disciplines.length);
            setText('#adminStatChapters', `${chapters.length} capítulos`);
            setText('#adminStatQuestions', totalQuestions);
            setText('#adminStatActiveQuestions', `${activeQuestions} ativas`);
        }
    } catch (error) {
        if (!quiet) notify(error.message, 4200);
        throw error;
    }
}
