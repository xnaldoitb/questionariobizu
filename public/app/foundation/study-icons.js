const ICONS = {
    book: '<path d="M5 5.8A2.8 2.8 0 0 1 7.8 3H19v15H7.8A2.8 2.8 0 0 0 5 20.8V5.8Z"/><path d="M5 20.8A2.8 2.8 0 0 1 7.8 18H19M9 7h6M9 11h5"/>',
    law: '<path d="M12 3v18M7 6h10M5 6l-3 6h6L5 6Zm14 0-3 6h6l-3-6Z"/><path d="M2 12c.4 2 5.6 2 6 0M16 12c.4 2 5.6 2 6 0M8 21h8"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    traffic: '<rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/>',
    health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
    computer: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 8h4M7 11h7"/>',
    language: '<path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4Z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h4V4Z"/>',
    fitness: '<circle cx="14" cy="4" r="2"/><path d="m10 9 3-2 3 3 3 1M13 7l-2 6-4 3M11 13l4 3 1 5M8 9 5 12"/>',
    mind: '<path d="M9 19H7a4 4 0 0 1-4-4V9a6 6 0 0 1 12 0v2l3 3h-3v4a3 3 0 0 1-3 3h-2v-5"/><path d="M7 9c1-2 4-2 5 0M8 12h3"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M10 7v6M7 10h6"/>',
    shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    people: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-3a5 5 0 0 1 10 0v3M13 21v-2.5a4 4 0 0 1 8 0V21"/>',
};

const RULES = [
    [/armamento|tiro|balistica/, 'target'],
    [/transito|trafego/, 'traffic'],
    [/primeiros socorros|saude|medicina/, 'health'],
    [/informatica|tecnologia|computacao/, 'computer'],
    [/portugues|redacao|literatura|lingua/, 'language'],
    [/educacao fisica|atividade fisica|treinamento fisico/, 'fitness'],
    [/psicologia|sociologia|comportamento/, 'mind'],
    [/criminologia|investigacao|criminalistica/, 'search'],
    [/direito|legislacao|constitucional|penal|processual/, 'law'],
    [/policia|policial|seguranca|abordagem|ordem unida/, 'shield'],
    [/direitos humanos|relacoes humanas/, 'people'],
];

function normalized(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export function disciplineIcon(name) {
    return RULES.find(([rule]) => rule.test(normalized(name)))?.[1] || 'book';
}

export function studyIcon(name, className = '') {
    const paths = ICONS[name] || ICONS.book;
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}
