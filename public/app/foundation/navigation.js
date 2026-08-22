import { one, all } from './selectors.js';

const screens = ['dashboard', 'quizView', 'resultView', 'adminView'];

const navigationTarget = {
    dashboard: 'navQuiz',
    adminView: 'navAdmin'
};

export function openScreen(screenId) {
    for (const id of screens) {
        one(`#${id}`)?.classList.toggle('hidden', id !== screenId);
    }

    for (const button of all('.action-button, .action-brand')) {
        button.classList.remove('active');
    }

    const activeButton = navigationTarget[screenId];
    if (activeButton) {
        one(`#${activeButton}`)?.classList.add('active');
    }
}
