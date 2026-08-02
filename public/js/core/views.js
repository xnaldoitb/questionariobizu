import { $, $$ } from './dom.js';

const views = [
    'dashboard',
    'quizView',
    'resultView',
    'historyView',
    'rankingView',
    'adminView'
];

const navigationByView = {
    dashboard: 'navQuiz',
    historyView: 'navHistory',
    rankingView: 'navRanking',
    adminView: 'navAdmin'
};

export function showView(id) {
    views.forEach((viewId) => {
        $(`#${viewId}`)?.classList.toggle('hidden', viewId !== id);
    });

    $$('.nav-btn').forEach((button) => button.classList.remove('active'));

    const navigationId = navigationByView[id];
    if (navigationId) {
        $(`#${navigationId}`)?.classList.add('active');
    }
}
