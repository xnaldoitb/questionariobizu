import { $, $$ } from './dom.js';

const views = [
    'dashboard',
    'quizView',
    'resultView',
    'adminView'
];

const navigationByView = {
    dashboard: 'navQuiz',
    adminView: 'navAdmin'
};

export function showView(id) {
    views.forEach((viewId) => {
        $(`#${viewId}`)?.classList.toggle('hidden', viewId !== id);
    });

    $$('.action-button, .action-brand').forEach((button) => {
        button.classList.remove('active');
    });

    const navigationId = navigationByView[id];
    if (navigationId) {
        $(`#${navigationId}`)?.classList.add('active');
    }
}
