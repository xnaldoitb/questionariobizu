import { safeText } from '../foundation/selectors.js';

const ICON_RULES = [
    [/armamento|tiro|balistica/, '1F3AF'],
    [/transito|trafego/, '1F6A6'],
    [/primeiros socorros|saude|medicina/, '26D1'],
    [/informatica|tecnologia|computacao/, '1F4BB'],
    [/portugues|redacao|literatura|lingua/, '1F4DA'],
    [/educacao fisica|atividade fisica|treinamento fisico/, '1F3C3'],
    [/psicologia|sociologia|comportamento/, '1F9E0'],
    [/criminologia|investigacao|criminalistica/, '1F50D'],
    [/direito|legislacao|constitucional|penal|processual/, '2696'],
    [/policia|policial|seguranca|abordagem|ordem unida/, '1F6E1'],
    [/direitos humanos|relacoes humanas/, '1F91D'],
];

function normalized(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export function disciplineIcon(name) {
    return ICON_RULES.find(([rule]) => rule.test(normalized(name)))?.[1] || '1F4D6';
}

export function renderDisciplineSelection(root, select, disciplines, chapters) {
    if (!root || !select) return;
    root.open = false;
    const chapterCount = new Map();
    chapters.forEach((chapter) => chapterCount.set(
        String(chapter.disciplina_id),
        (chapterCount.get(String(chapter.disciplina_id)) || 0) + 1,
    ));

    const selected = disciplines.find((item) => String(item.id) === String(select.value)) || disciplines[0];
    if (selected) select.value = selected.id;

    root.innerHTML = `
        <summary aria-label="Selecionar disciplina"></summary>
        <div class="discipline-options">
            <div class="discipline-search-wrap">
                <input type="search" data-discipline-search placeholder="Buscar disciplina…" aria-label="Buscar disciplina">
            </div>
            <div class="discipline-option-list">
                ${disciplines.map((discipline) => {
                    const count = chapterCount.get(String(discipline.id)) || 0;
                    const code = disciplineIcon(discipline.nome);
                    return `<button type="button" data-discipline-id="${safeText(discipline.id)}" data-search="${safeText(normalized(discipline.nome))}">
                        <img src="/assets/openmoji/${code}.svg" width="32" height="32" alt="" loading="lazy">
                        <span><strong>${safeText(discipline.nome)}</strong><small>${count} ${count === 1 ? 'capítulo' : 'capítulos'}</small></span>
                        <i aria-hidden="true">✓</i>
                    </button>`;
                }).join('')}
                <p class="discipline-empty hidden">Nenhuma disciplina encontrada.</p>
            </div>
        </div>`;

    const update = () => {
        const discipline = disciplines.find((item) => String(item.id) === String(select.value)) || disciplines[0];
        if (!discipline) return;
        const count = chapterCount.get(String(discipline.id)) || 0;
        root.querySelector('summary').innerHTML = `
            <img src="/assets/openmoji/${disciplineIcon(discipline.nome)}.svg" width="30" height="30" alt="">
            <span><strong>${safeText(discipline.nome)}</strong><small>${count} ${count === 1 ? 'capítulo' : 'capítulos'}</small></span>`;
        root.querySelectorAll('[data-discipline-id]').forEach((button) => {
            button.classList.toggle('is-selected', String(button.dataset.disciplineId) === String(discipline.id));
        });
    };

    root.onclick = (event) => {
        const button = event.target.closest('[data-discipline-id]');
        if (!button) return;
        select.value = button.dataset.disciplineId;
        update();
        root.open = false;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        root.querySelector('summary').focus();
    };
    root.oninput = (event) => {
        if (!event.target.matches('[data-discipline-search]')) return;
        const query = normalized(event.target.value.trim());
        let visible = 0;
        root.querySelectorAll('[data-discipline-id]').forEach((button) => {
            const show = !query || button.dataset.search.includes(query);
            button.classList.toggle('hidden', !show);
            if (show) visible += 1;
        });
        root.querySelector('.discipline-empty').classList.toggle('hidden', visible > 0);
    };
    root.onkeydown = (event) => {
        if (event.key === 'Escape') {
            root.open = false;
            root.querySelector('summary').focus();
        }
    };
    root.ontoggle = () => {
        if (!root.open) return;
        const search = root.querySelector('[data-discipline-search]');
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        search.focus();
    };
    update();
}
