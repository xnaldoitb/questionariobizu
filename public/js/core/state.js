export const state = {
    user: null,
    catalog: {
        disciplinas: [],
        capitulos: []
    },
    quiz: {
        questions: [],
        current: 0,
        sessionId: null,
        locked: false,
        stats: {
            answered: 0,
            correct: 0,
            skipped: 0
        }
    }
};
