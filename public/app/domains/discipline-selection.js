import { safeText } from '../foundation/selectors.js';
import { disciplineIcon, studyIcon } from '../foundation/study-icons.js';

function normalized(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

export { disciplineIcon };

export function renderDisciplineSelection(root, select, disciplines, chapters) {
    if (!root || !select) return;

    const chapterCount = new Map();
    chapters.forEach((chapter) => chapterCount.set(
        String(chapter.disciplina_id),
        (chapterCount.get(String(chapter.disciplina_id)) || 0) + 1,
    ));

    const selected = disciplines.find((item) => String(item.id) === String(select.value)) || disciplines[0];
    if (selected) select.value = selected.id;

    root.innerHTML = disciplines.map((discipline) => {
        const count = chapterCount.get(String(discipline.id)) || 0;
        return `<button type="button" role="option" data-discipline-id="${safeText(discipline.id)}"
            data-search="${safeText(normalized(discipline.nome))}">
            <span class="discipline-line-icon">${studyIcon(disciplineIcon(discipline.nome))}</span>
            <span><strong>${safeText(discipline.nome)}</strong><small>${count} ${count === 1 ? 'capítulo' : 'capítulos'}</small></span>
            <i aria-hidden="true">✓</i>
        </button>`;
    }).join('') + '<p class="discipline-empty hidden">Nenhuma disciplina encontrada.</p>';

    const update = () => {
        const discipline = disciplines.find((item) => String(item.id) === String(select.value)) || disciplines[0];
        if (!discipline) return;

        const count = chapterCount.get(String(discipline.id)) || 0;
        const summary = document.querySelector('#subjectSelectionSummary');
        const meta = document.querySelector('#subjectSelectionMeta');
        if (summary) summary.textContent = discipline.nome;
        if (meta) meta.textContent = `${count} ${count === 1 ? 'capítulo disponível' : 'capítulos disponíveis'}`;

        root.querySelectorAll('[data-discipline-id]').forEach((button) => {
            const active = String(button.dataset.disciplineId) === String(discipline.id);
            button.classList.toggle('is-selected', active);
            button.setAttribute('aria-selected', String(active));
        });
    };

    root.onclick = (event) => {
        const button = event.target.closest('[data-discipline-id]');
        if (!button) return;
        select.value = button.dataset.disciplineId;
        update();
        select.dispatchEvent(new Event('change', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('study-filter:close', { detail: { id: 'subjectModal' } }));
    };

    const search = document.querySelector('#subjectSearch');
    if (search) {
        search.oninput = () => {
            const query = normalized(search.value.trim());
            let visible = 0;
            root.querySelectorAll('[data-discipline-id]').forEach((button) => {
                const show = !query || button.dataset.search.includes(query);
                button.classList.toggle('hidden', !show);
                if (show) visible += 1;
            });
            root.querySelector('.discipline-empty')?.classList.toggle('hidden', visible > 0);
        };
    }

    update();
}
