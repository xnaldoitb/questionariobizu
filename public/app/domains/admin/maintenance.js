import { requestJson } from '../../foundation/request.js';
import { one, notify } from '../../foundation/selectors.js';
import { refreshCatalog } from '../catalog.js';
import { adminState } from './common.js';
import { refreshAdminCatalog } from './content.js';

async function refreshAllCatalogs() {
    await Promise.all([refreshCatalog(), refreshAdminCatalog({ quiet: true })]);
}

async function endStudentSessions() {
    if (!confirm('Encerrar agora todas as sessões ativas de alunos? Eles precisarão entrar novamente.')) return;

    try {
        const result = await requestJson('admin-maintenance', {
            method: 'POST',
            body: JSON.stringify({ action: 'end_student_sessions' }),
        });
        notify(`${result.sessoes_encerradas || 0} sessão(ões) encerrada(s).`);
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function clearAllResults() {
    const first = confirm(
        'ATENÇÃO: esta ação apagará todo o histórico, respostas e ranking de todos os usuários. Usuários e questões serão preservados. Deseja continuar?',
    );
    if (!first) return;

    const required = 'LIMPAR TODOS OS RESULTADOS';
    const typed = prompt(`Digite exatamente a frase abaixo para confirmar:\n\n${required}`);
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== required) {
        notify('Frase de confirmação incorreta. Nada foi apagado.');
        return;
    }

    try {
        const result = await requestJson('admin-maintenance', {
            method: 'POST',
            body: JSON.stringify({ action: 'clear_results', confirmacao: required }),
        });
        notify(`Resultados limpos: ${result.removidos?.sessoes || 0} sessões e ${result.removidos?.respostas || 0} respostas removidas.`, 5000);
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function purgeSelectedDiscipline() {
    const id = one('#maintenanceDiscipline')?.value;
    const discipline = adminState.catalog.disciplinas.find((item) => item.id === id);
    if (!discipline) {
        notify('Selecione uma disciplina.');
        return;
    }

    const first = confirm(
        `ATENÇÃO: excluir “${discipline.nome}” removerá permanentemente a disciplina, capítulos, questões e dados de estudo vinculados. Deseja continuar?`,
    );
    if (!first) return;

    const typed = prompt(`Para confirmar, digite exatamente o nome da disciplina:\n\n${discipline.nome}`);
    if (typed === null) return;
    if (typed.trim() !== discipline.nome) {
        notify('Nome de confirmação incorreto. Nada foi excluído.');
        return;
    }

    try {
        const result = await requestJson(
            `admin-catalogo?tipo=disciplina&acao=excluir-completa&id=${encodeURIComponent(id)}`,
            {
                method: 'DELETE',
                body: JSON.stringify({ confirmacao: discipline.nome }),
            },
        );
        await refreshAllCatalogs();
        notify(`Disciplina excluída: ${result.removidos?.capitulos || 0} capítulos e ${result.removidos?.questoes || 0} questões removidos.`, 5000);
    } catch (error) {
        notify(error.message, 4200);
    }
}

async function deleteAllDisciplines() {
    if (!adminState.catalog.disciplinas.length) {
        notify('Não há disciplinas cadastradas para excluir.');
        return;
    }

    const total = adminState.catalog.disciplinas.length;
    if (!confirm(`ATENÇÃO MÁXIMA: excluir TODAS as ${total} disciplina(s), capítulos, questões e resultados vinculados? Usuários serão preservados.`)) return;

    const required = 'EXCLUIR TODAS AS DISCIPLINAS';
    const typed = prompt(`Digite exatamente a frase abaixo:\n\n${required}`);
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== required) {
        notify('Frase de confirmação incorreta. Nada foi excluído.');
        return;
    }
    if (!confirm('Última confirmação: esta operação é irreversível. Excluir tudo agora?')) return;

    const button = one('#deleteAllDisciplinesBtn');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Excluindo...';

    try {
        const result = await requestJson('admin-catalogo', {
            method: 'POST',
            body: JSON.stringify({
                tipo: 'disciplina',
                acao: 'excluir-todas',
                confirmacao: required,
            }),
        });
        await refreshAllCatalogs();
        const removed = result.removidos || {};
        notify(`Exclusão concluída: ${removed.disciplinas || 0} disciplinas, ${removed.capitulos || 0} capítulos e ${removed.questoes || 0} questões removidos.`, 5200);
    } catch (error) {
        notify(error.message, 4200);
    } finally {
        button.disabled = false;
        button.textContent = original;
    }
}

export function bindMaintenanceManagement() {
    one('#endSessionsBtn')?.addEventListener('click', endStudentSessions);
    one('#clearResultsBtn')?.addEventListener('click', clearAllResults);
    one('#purgeSelectedDisciplineBtn')?.addEventListener('click', purgeSelectedDiscipline);
    one('#deleteAllDisciplinesBtn')?.addEventListener('click', deleteAllDisciplines);
}
