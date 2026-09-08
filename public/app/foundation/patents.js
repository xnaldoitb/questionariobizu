const FAMILY_DETAILS = {
    trainee: ['Barra prateada', 'O começo de uma longa jornada de estudo.'],
    enlisted: ['Barras de progressão', 'Base construída com prática e constância.'],
    sergeant: ['Divisas metálicas', 'Disciplina, regularidade e domínio crescente.'],
    seniorSergeant: ['Divisas e marcadores dourados', 'Experiência consolidada na resolução de questões.'],
    juniorOfficer: ['Distintivos prateados sobre azul', 'Estratégia e precisão nos estudos.'],
    officer: ['Distintivos de oficial sobre azul', 'Liderança conquistada pelo conhecimento.'],
    captain: ['Estrela prateada e graduações', 'Comando seguro sobre grandes blocos de conteúdo.'],
    major: ['Estrela metálica sobre verde', 'Desempenho avançado e visão estratégica.'],
    lieutenantColonel: ['Estrela de comando sobre verde', 'Maturidade, constância e excelência acadêmica.'],
    colonel: ['Estrela dourada sobre verde', 'Referência de disciplina para toda a comunidade.'],
    general: ['Estrelas douradas sobre vermelho', 'Patamar de excelência entre os grandes estudiosos.'],
    hero: ['Estrela heroica em vermelho e dourado', 'A maior patente permanente do Questionário Bizu.'],
};

const LEGACY_DEFINITIONS = [
    [0, 'Aspirante do Bizu', 'trainee', 1],
    [20, 'Recruta do Conhecimento', 'enlisted', 1],
    [50, 'Soldado das Questões', 'enlisted', 2],
    [100, 'Cabo da Estratégia', 'enlisted', 3],
    [175, 'Sargento do Gabarito', 'sergeant', 1],
    [275, 'Terceiro-Sargento do Estudo I', 'sergeant', 1],
    [400, 'Terceiro-Sargento do Estudo II', 'sergeant', 2],
    [550, 'Terceiro-Sargento do Estudo III', 'sergeant', 3],
    [750, 'Segundo-Sargento da Disciplina I', 'sergeant', 1],
    [1000, 'Segundo-Sargento da Disciplina II', 'sergeant', 2],
    [1300, 'Segundo-Sargento da Disciplina III', 'sergeant', 3],
    [1650, 'Segundo-Sargento da Disciplina IV', 'sergeant', 4],
    [2050, 'Primeiro-Sargento das Questões I', 'seniorSergeant', 1],
    [2500, 'Primeiro-Sargento das Questões II', 'seniorSergeant', 2],
    [3000, 'Primeiro-Sargento das Questões III', 'seniorSergeant', 3],
    [3600, 'Primeiro-Sargento das Questões IV', 'seniorSergeant', 4],
    [4300, 'Subtenente do Conhecimento', 'seniorSergeant', 5],
    [5000, 'Segundo-Tenente da Estratégia I', 'juniorOfficer', 1],
    [5400, 'Segundo-Tenente da Estratégia II', 'juniorOfficer', 2],
    [5800, 'Segundo-Tenente da Estratégia III', 'juniorOfficer', 3],
    [6200, 'Segundo-Tenente da Estratégia IV', 'juniorOfficer', 4],
    [6650, 'Oficial de Questões I', 'officer', 1],
    [7100, 'Oficial de Questões II', 'officer', 2],
    [7600, 'Oficial de Questões III', 'officer', 3],
    [8100, 'Oficial de Questões IV', 'officer', 4],
    [8650, 'Oficial de Questões V', 'officer', 5],
    [9200, 'Capitão do Saber I', 'captain', 1],
    [9800, 'Capitão do Saber II', 'captain', 2],
    [10400, 'Capitão do Saber III', 'captain', 3],
    [11050, 'Capitão do Saber IV', 'captain', 4],
    [11700, 'Capitão do Saber V', 'captain', 5],
    [12400, 'Major do Conhecimento I', 'major', 1],
    [13100, 'Major do Conhecimento II', 'major', 2],
    [13850, 'Major do Conhecimento III', 'major', 3],
    [14600, 'Major do Conhecimento IV', 'major', 4],
    [15400, 'Major do Conhecimento V', 'major', 5],
    [16200, 'Tenente-Coronel da Disciplina I', 'lieutenantColonel', 1],
    [17050, 'Tenente-Coronel da Disciplina II', 'lieutenantColonel', 2],
    [17900, 'Tenente-Coronel da Disciplina III', 'lieutenantColonel', 3],
    [18800, 'Tenente-Coronel da Disciplina IV', 'lieutenantColonel', 4],
    [19700, 'Tenente-Coronel da Disciplina V', 'lieutenantColonel', 5],
    [20650, 'Coronel da Estratégia I', 'colonel', 1],
    [21600, 'Coronel da Estratégia II', 'colonel', 2],
    [22600, 'Coronel da Estratégia III', 'colonel', 3],
    [23600, 'Coronel da Estratégia IV', 'colonel', 4],
    [24650, 'Coronel da Estratégia V', 'colonel', 5],
    [25700, 'Brigadeiro do Saber', 'general', 1],
    [26800, 'Major-General do Conhecimento', 'general', 2],
    [27950, 'Tenente-General das Questões', 'general', 3],
    [29100, 'General do Bizu', 'general', 4],
    [30300, 'Comandante do Saber', 'general', 5],
    [32000, 'Herói do Conhecimento', 'hero', 5],
];

// Os limites originais eram baseados em acertos. A partir da v4.44 cada marco
// vale dez vezes mais e passa a representar XP, sem rebaixar usuários antigos.
const DEFINITIONS = LEGACY_DEFINITIONS.map(([min, name, family, grade]) => [min * 10, name, family, grade]);

export const PATENTS = DEFINITIONS.map(([min, name, family, grade], level) => ({
    min,
    name,
    family,
    grade,
    level,
    symbol: `${FAMILY_DETAILS[family][0]}${grade > 1 && !['general', 'hero'].includes(family) ? ` · grau ${grade}` : ''}`,
    meaning: FAMILY_DETAILS[family][1],
}));

export const DEVELOPER_PATENT = {
    level: 'developer',
    family: 'developer',
    grade: 1,
    name: 'Comandante do Código',
    symbol: 'Estrela, código e DEV',
    meaning: 'Patente institucional exclusiva de quem desenvolve e mantém o Questionário Bizu.',
};

export const ADMIN_PATENT = {
    level: 'admin',
    family: 'admin',
    grade: 1,
    name: 'Oficial de Instrução',
    symbol: 'Livro aberto dourado, estrela azul e ADM',
    meaning: 'Patente institucional exclusiva dos administradores que orientam e apoiam a comunidade do Questionário Bizu.',
};

export function patentForHits(value) {
    const hits = Math.max(0, Number(value) || 0);
    for (let index = PATENTS.length - 1; index >= 0; index -= 1) {
        if (hits >= PATENTS[index].min) return PATENTS[index];
    }
    return PATENTS[0];
}

export function patentProgress(value) {
    const hits = Math.max(0, Number(value) || 0);
    const current = patentForHits(hits);
    const next = PATENTS[current.level + 1] || null;
    const span = next ? next.min - current.min : 1;
    const progress = next ? Math.min(100, Math.round(((hits - current.min) / span) * 100)) : 100;
    return { hits, current, next, remaining: next ? Math.max(next.min - hits, 0) : 0, progress };
}

function star(cx, cy, radius = 5) {
    const points = Array.from({ length: 10 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        const length = index % 2 ? radius * 0.43 : radius;
        return `${(cx + Math.cos(angle) * length).toFixed(1)},${(cy + Math.sin(angle) * length).toFixed(1)}`;
    }).join(' ');
    return `<polygon class="patent-star" points="${points}"/>`;
}

function officerPip(cx, cy, scale = 1) {
    return `<path class="patent-pip" transform="translate(${cx} ${cy}) scale(${scale})" d="m0-8 5 5-2 4 5 5-8-2-8 2 5-5-2-4 5-5Z"/>`;
}

function gradeMarks(grade, { y = 49, stars = false } = {}) {
    const count = Math.max(1, Math.min(5, grade));
    const gap = 8;
    const start = 32 - ((count - 1) * gap) / 2;
    return Array.from({ length: count }, (_, index) => stars
        ? star(start + index * gap, y, 3.2)
        : `<circle class="patent-grade-dot" cx="${start + index * gap}" cy="${y}" r="2.4"/>`).join('');
}

function fieldGradeMarks(grade, kind) {
    const count = Math.max(1, Math.min(5, grade));
    const gap = 7.5;
    const start = 32 - ((count - 1) * gap) / 2;
    return Array.from({ length: count }, (_, index) => {
        const x = start + index * gap;
        return kind === 'major'
            ? `<rect class="patent-field-grade patent-major-grade" x="${(x - 2.7).toFixed(1)}" y="45" width="5.4" height="4.8" rx="1"/>`
            : `<polygon class="patent-field-grade patent-lieutenant-grade" points="${x.toFixed(1)},43 ${(x + 3.3).toFixed(1)},47 ${(x).toFixed(1)},51 ${(x - 3.3).toFixed(1)},47"/>`;
    }).join('');
}

function chevrons(count, startY = 20) {
    return Array.from({ length: count }, (_, index) => {
        const y = startY + index * 8;
        return `<path class="patent-chevron" d="m18 ${y} 14 8 14-8"/>`;
    }).join('');
}

function patentMarks(patent) {
    const { family, grade, level } = patent;
    if (family === 'trainee') return '<g class="patent-trainee-mark"><path class="patent-rank-bar" d="M24 20v28M32 17v34M40 20v28"/></g>';
    if (family === 'enlisted') {
        const bars = Array.from({ length: grade + 1 }, (_, index) => `<path class="patent-rank-bar" d="M19 ${23 + index * 9}h26"/>`).join('');
        return `<g class="patent-enlisted-bars">${bars}</g>`;
    }
    if (family === 'sergeant') {
        if (level === 4) return `<g class="patent-sergeant-chevrons patent-sergeant-base">${chevrons(1)}</g>`;
        const thirdSergeant = level <= 7;
        if (thirdSergeant) {
            const baseStart = 51 - ((grade - 1) * 5);
            const progressiveBase = Array.from({ length: grade }, (_, index) => {
                const inset = index * 2;
                return `<path class="patent-rocker patent-progressive-base" d="M${20 + inset} ${baseStart + index * 5}h${24 - inset * 2}"/>`;
            }).join('');
            return `<g class="patent-sergeant-chevrons patent-sergeant-tier-1">${chevrons(2, 16)}${progressiveBase}</g>`;
        }
        return `<g class="patent-sergeant-chevrons patent-sergeant-tier-2">${chevrons(3, 15)}<g class="patent-progressive-dots">${gradeMarks(grade, { y: 49 })}</g></g>`;
    }
    if (family === 'seniorSergeant') {
        if (level === 16) return `<g class="patent-subtenente-mark">${star(32, 15, 5.2)}<polygon class="patent-subtenente-triangle" points="32,25 18,49 46,49"/></g>`;
        return `<g class="patent-senior-sergeant">${chevrons(4, 10)}<g class="patent-progressive-stars">${gradeMarks(grade, { y: 50, stars: true })}</g></g>`;
    }
    if (family === 'juniorOfficer') return `<g class="patent-officer-pips">${officerPip(32, 29, 1.08)}${gradeMarks(grade)}</g>`;
    if (family === 'officer') return `<g class="patent-officer-pips">${officerPip(24, 29, .9)}${officerPip(40, 29, .9)}${gradeMarks(grade)}</g>`;
    if (family === 'captain') return `<g class="patent-officer-stars">${star(32, 29, 9)}${gradeMarks(grade)}</g>`;
    if (family === 'major') return `<g class="patent-field-officer patent-major">${star(32, 27, 8)}<g class="patent-major-progress">${fieldGradeMarks(grade, 'major')}</g></g>`;
    if (family === 'lieutenantColonel') return `<g class="patent-field-officer patent-lieutenantColonel">${star(32, 27, 9)}<g class="patent-lieutenant-progress">${fieldGradeMarks(grade, 'lieutenant')}</g></g>`;
    if (family === 'colonel') return `<g class="patent-field-officer patent-colonel">${star(32, 27, 10)}${gradeMarks(grade, { stars: true })}</g>`;
    if (family === 'general') {
        if (level === 50) return `<g class="patent-command-marks patent-command-${level} patent-command-stars">${star(32, 25, 10.5)}${gradeMarks(4, { y: 47, stars: true })}</g>`;
        const count = Math.min(4, grade);
        const positions = [[32, 22], [22, 36], [42, 36], [32, 46]];
        return `<g class="patent-command-marks patent-command-${level}">${positions.slice(0, count).map(([x, y]) => star(x, y, count === 1 ? 10 : 6.5)).join('')}</g>`;
    }
    return `<g class="patent-hero-marks patent-hero-cluster">${star(32, 32, 10.5)}${star(32, 13, 3.8)}${star(17, 23, 3.8)}${star(47, 23, 3.8)}${star(18, 46, 3.8)}${star(46, 46, 3.8)}</g>`;
}

function patentFrame(patent) {
    const tier = ['general', 'hero'].includes(patent.family) ? 'command'
        : ['major', 'lieutenantColonel', 'colonel'].includes(patent.family) ? 'field'
            : ['juniorOfficer', 'officer', 'captain'].includes(patent.family) ? 'officer'
                : patent.family === 'seniorSergeant' ? 'gold' : 'enlisted';
    return `<g class="patent-frame patent-frame-${tier}">
        <rect class="patent-tile-shadow" x="4" y="5" width="56" height="56" rx="4"/>
        <rect class="patent-tile-frame" x="5" y="4" width="54" height="54" rx="3"/>
        <rect class="patent-tile-inner" x="9" y="8" width="46" height="46" rx="1.5"/>
        <path class="patent-tile-bevel" d="M10 52V10h44M7 57l4-4h42l4 4"/>
        <path class="patent-tile-gloss" d="M10 9h44v15c-13-7-30-7-44 2V9Z"/>
    </g>`;
}

function developerMarks() {
    return `<g class="patent-developer-marks">
        ${star(32, 17, 5.7)}
        <path class="patent-code-mark" d="m24 27-7 6 7 6m16-12 7 6-7 6m-4-15-8 19"/>
        <text class="patent-dev-label" x="32" y="51" text-anchor="middle">DEV</text>
    </g>`;
}

function adminMarks() {
    return `<g class="patent-admin-marks">
        ${star(32, 15, 5.8)}
        <path class="patent-admin-book" d="M13 25c7.5-2.2 13.8-.5 19 4.2V50c-5.2-4.1-11.5-5.6-19-3.6V25Zm38 0c-7.5-2.2-13.8-.5-19 4.2V50c5.2-4.1 11.5-5.6 19-3.6V25Z"/>
        <path class="patent-admin-page" d="M32 29.2V50M17 31c4.6-.6 8.3.3 11.4 2.6M47 31c-4.6-.6-8.3.3-11.4 2.6"/>
        <text class="patent-admin-label" x="32" y="57" text-anchor="middle">ADM</text>
    </g>`;
}

export function patentInsigniaMarkup(value, { compact = false, decorative = false, developer = false, admin = false } = {}) {
    const patent = developer ? DEVELOPER_PATENT : admin ? ADMIN_PATENT : patentForHits(value);
    const aria = decorative ? 'aria-hidden="true"' : `role="img" aria-label="${patent.name}"`;
    const framePatent = developer ? { family: 'general' } : admin ? { family: 'officer' } : patent;
    return `<span class="patent-insignia patent-level-${patent.level} patent-family-${patent.family}${developer ? ' is-developer' : ''}${admin ? ' is-admin' : ''}${compact ? ' is-compact' : ''}" data-patent-level="${patent.level}" ${aria}>
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            ${patentFrame(framePatent)}
            ${developer ? developerMarks() : admin ? adminMarks() : patentMarks(patent)}
        </svg>
    </span>`;
}

export function patentButtonMarkup(value, { compact = false, papirao = false, developer = false, admin = false } = {}) {
    const patent = developer ? DEVELOPER_PATENT : admin ? ADMIN_PATENT : patentForHits(value);
    if (papirao) {
        return `<button class="patent-button papirao-patent-button" type="button" data-patent-detail data-patent-hits="${Math.max(0, Number(value) || 0)}" data-papirao="true" aria-label="Ver conquista PAPIRÃO e patente ${patent.name}"><span class="podium-champion-crown"><img src="/assets/icons/coroa-papirao.svg" alt="" aria-hidden="true"></span></button>`;
    }
    return `<button class="patent-button${compact ? ' is-compact' : ''}" type="button" data-patent-detail data-patent-hits="${Math.max(0, Number(value) || 0)}"${developer ? ' data-developer="true"' : ''}${admin ? ' data-admin="true"' : ''} aria-label="Ver patente ${patent.name}">${patentInsigniaMarkup(value, { compact, decorative: true, developer, admin })}</button>`;
}
