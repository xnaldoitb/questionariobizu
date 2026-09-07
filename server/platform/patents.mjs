export const PATENTS = [
    [0, 'Aspirante do Bizu'], [20, 'Recruta do Conhecimento'], [50, 'Soldado das Questões'],
    [100, 'Cabo da Estratégia'], [175, 'Sargento do Gabarito'],
    [275, 'Terceiro-Sargento do Estudo I'], [400, 'Terceiro-Sargento do Estudo II'],
    [550, 'Terceiro-Sargento do Estudo III'], [750, 'Segundo-Sargento da Disciplina I'],
    [1000, 'Segundo-Sargento da Disciplina II'], [1300, 'Segundo-Sargento da Disciplina III'],
    [1650, 'Segundo-Sargento da Disciplina IV'], [2050, 'Primeiro-Sargento das Questões I'],
    [2500, 'Primeiro-Sargento das Questões II'], [3000, 'Primeiro-Sargento das Questões III'],
    [3600, 'Primeiro-Sargento das Questões IV'], [4300, 'Subtenente do Conhecimento'],
    [5000, 'Segundo-Tenente da Estratégia I'], [5400, 'Segundo-Tenente da Estratégia II'],
    [5800, 'Segundo-Tenente da Estratégia III'], [6200, 'Segundo-Tenente da Estratégia IV'],
    [6650, 'Oficial de Questões I'], [7100, 'Oficial de Questões II'],
    [7600, 'Oficial de Questões III'], [8100, 'Oficial de Questões IV'],
    [8650, 'Oficial de Questões V'], [9200, 'Capitão do Saber I'],
    [9800, 'Capitão do Saber II'], [10400, 'Capitão do Saber III'],
    [11050, 'Capitão do Saber IV'], [11700, 'Capitão do Saber V'],
    [12400, 'Major do Conhecimento I'], [13100, 'Major do Conhecimento II'],
    [13850, 'Major do Conhecimento III'], [14600, 'Major do Conhecimento IV'],
    [15400, 'Major do Conhecimento V'], [16200, 'Tenente-Coronel da Disciplina I'],
    [17050, 'Tenente-Coronel da Disciplina II'], [17900, 'Tenente-Coronel da Disciplina III'],
    [18800, 'Tenente-Coronel da Disciplina IV'], [19700, 'Tenente-Coronel da Disciplina V'],
    [20650, 'Coronel da Estratégia I'], [21600, 'Coronel da Estratégia II'],
    [22600, 'Coronel da Estratégia III'], [23600, 'Coronel da Estratégia IV'],
    [24650, 'Coronel da Estratégia V'], [25700, 'Brigadeiro do Saber'],
    [26800, 'Major-General do Conhecimento'], [27950, 'Tenente-General das Questões'],
    [29100, 'General do Bizu'], [30300, 'Comandante do Saber'],
    [32000, 'Herói do Conhecimento'],
].map(([min, name], level) => ({ min, name, level }));

export function patentForHits(value) {
    const hits = Math.max(0, Number(value) || 0);
    for (let index = PATENTS.length - 1; index >= 0; index -= 1) {
        if (hits >= PATENTS[index].min) return PATENTS[index];
    }
    return PATENTS[0];
}

export function patentStatus(value) {
    const hits = Math.max(0, Number(value) || 0);
    const current = patentForHits(hits);
    const next = PATENTS[current.level + 1] || null;
    const progress = next
        ? Math.min(100, Math.round(((hits - current.min) / (next.min - current.min)) * 100))
        : 100;
    return {
        nivel: current.level,
        nome: current.name,
        minimo: current.min,
        proxima: next?.name || null,
        proximo_minimo: next?.min || null,
        acertos: hits,
        faltam: next ? Math.max(next.min - hits, 0) : 0,
        progresso: progress,
    };
}
