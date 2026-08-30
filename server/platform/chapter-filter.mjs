export function parseChapterIds(params) {
    const raw = params.capitulos ?? params.capitulo ?? '';
    if (raw === '') return [];
    if (typeof raw !== 'string') throw new Error('Seleção de capítulos inválida.');
    const parts = raw.split(',');
    if (parts.length > 500 || parts.some((id) => !/^\d+$/.test(id)
        || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
        throw new Error('Seleção de capítulos inválida.');
    }
    return [...new Set(parts.map(Number))];
}
