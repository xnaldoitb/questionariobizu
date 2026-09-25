import { one, safeText, notify } from '../foundation/selectors.js';
import { openScreen } from '../foundation/navigation.js';

const STOP_WORDS = new Set([
    'a', 'à', 'às', 'ao', 'aos', 'as', 'o', 'os', 'e', 'é', 'de', 'da', 'das', 'do', 'dos',
    'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'que', 'se', 'por', 'para',
    'com', 'sem', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'te', 'tu', 'mais', 'mas', 'ou'
]);

const LEVELS = [
    { label: 'Ler', help: 'A letra inteira, exatamente como está no material de origem.' },
    { label: 'Clarear', help: 'Um quarto das palavras some. Revele somente quando travar.' },
    { label: 'Apagar', help: 'Metade das palavras some para exigir mais da memória.' },
    { label: 'Iniciais', help: 'Só a primeira letra de cada palavra permanece.' },
    { label: 'De cabeça', help: 'Folha em branco. Cante inteiro antes de conferir.' }
];

let hymns = [];
let currentHymn = null;
let currentMode = 'letra';
let memoryLevel = 0;
let memoryRound = 1;
let revealed = new Set();
let peeks = 0;
let completeQuestions = [];
let completeIndex = 0;
let completeHits = 0;
let completeLocked = false;
let orderSection = 0;
let orderRound = 1;
let orderRemaining = [];
let orderPicked = [];

function cleanWord(value) {
    return String(value || '')
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
        .toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function isEligibleWord(value) {
    const cleaned = cleanWord(value);
    return cleaned.length >= 4 && !STOP_WORDS.has(cleaned);
}

function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) {
        result ^= character.charCodeAt(0);
        result = Math.imul(result, 16777619);
    }
    return result >>> 0;
}

function shuffled(items, seed) {
    return [...items]
        .map((item, index) => ({ item, score: hash(`${seed}:${index}:${JSON.stringify(item)}`) }))
        .sort((left, right) => left.score - right.score)
        .map(({ item }) => item);
}

function storageKey(slug) {
    return `bizu:hino:${slug}`;
}

function readProgress(slug) {
    try {
        return JSON.parse(localStorage.getItem(storageKey(slug)) || '{}');
    } catch {
        return {};
    }
}

function saveProgress(patch) {
    if (!currentHymn) return;
    try {
        localStorage.setItem(storageKey(currentHymn.slug), JSON.stringify({
            ...readProgress(currentHymn.slug),
            ...patch
        }));
    } catch {}
}

function totalVerses(hymn) {
    return hymn.secoes.reduce((total, section) => total + section.versos.length, 0);
}

function sectionLabel(section, index) {
    if (section.tipo === 'coro') return section.rotulo || 'Coro';
    if (section.rotulo) return `Estrofe ${section.rotulo}`;
    return `Parte ${index + 1}`;
}

async function loadHymns() {
    if (hymns.length) return hymns;
    const response = await fetch('/assets/hinos/hinos.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível carregar os hinos.');
    const payload = await response.json();
    hymns = Array.isArray(payload.hinos) ? payload.hinos : [];
    return hymns;
}

function searchable(value) {
    return String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderSelector() {
    const options = one('#hymnOptions');
    if (!options) return;
    options.innerHTML = hymns.map((hymn) => {
        const sections = hymn.secoes.length > 1 ? ` · ${hymn.secoes.length} partes` : '';
        return `
            <button type="button" role="option" data-hymn-slug="${safeText(hymn.slug)}"
                data-search="${safeText(searchable(`${hymn.titulo} ${hymn.autoria || ''}`))}"
                aria-selected="${currentHymn?.slug === hymn.slug}" class="${currentHymn?.slug === hymn.slug ? 'is-selected' : ''}">
                <span class="discipline-line-icon hymn-line-icon" aria-hidden="true">♫</span>
                <span><strong>${safeText(hymn.titulo)}</strong><small>${totalVerses(hymn)} versos${sections}${hymn.audio ? ' · com áudio' : ''}</small></span>
                <i aria-hidden="true">${currentHymn?.slug === hymn.slug ? '✓' : '›'}</i>
            </button>
        `;
    }).join('');
}

function closeSelector() {
    const modal = one('#hymnModal');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    if (!one('.modal-overlay:not(.hidden)')) document.body.classList.remove('modal-open');
    one('#hymnPicker')?.focus({ preventScroll: true });
}

async function openSelector() {
    try {
        await loadHymns();
        renderSelector();
        openScreen('dashboard');
        const search = one('#hymnSearch');
        if (search) search.value = '';
        one('#hymnModal')?.classList.remove('hidden');
        document.body.classList.add('modal-open');
        one('#hymnModalClose')?.focus({ preventScroll: true });
    } catch (error) {
        notify(error.message || 'Não foi possível abrir a sala de canto.');
    }
}

function filterSelector(query) {
    const term = searchable(query);
    for (const option of document.querySelectorAll('#hymnOptions [data-hymn-slug]')) {
        option.hidden = !option.dataset.search.includes(term);
    }
}

function returnToSelector() {
    const audio = one('#hymnAudio');
    if (audio) audio.pause();
    openSelector();
}

function resetStudyState(hymn) {
    const progress = readProgress(hymn.slug);
    currentMode = 'letra';
    memoryLevel = Math.min(Number(progress.nivel) || 0, LEVELS.length - 1);
    memoryRound = 1;
    revealed = new Set();
    peeks = 0;
    completeQuestions = [];
    completeIndex = 0;
    completeHits = 0;
    completeLocked = false;
    orderSection = 0;
    orderRound = 1;
    orderRemaining = [];
    orderPicked = [];
}

function openHymn(slug) {
    const hymn = hymns.find((item) => item.slug === slug);
    if (!hymn) return;
    currentHymn = hymn;
    resetStudyState(hymn);
    closeSelector();
    openScreen('hymnsView');
    one('#hymnDetail')?.classList.remove('hidden');
    one('#hymnSelectionSummary').textContent = hymn.titulo;
    one('#hymnSelectionMeta').textContent = `${totalVerses(hymn)} versos · ${hymn.secoes.length} ${hymn.secoes.length === 1 ? 'parte' : 'partes'}${hymn.audio ? ' · com áudio' : ''}`;
    one('#hymnTitle').textContent = hymn.titulo;
    one('#hymnAuthor').textContent = hymn.autoria || '';
    one('#hymnOrigin').textContent = hymn.origem || '';

    const panel = one('#hymnAudioPanel');
    const audio = one('#hymnAudio');
    panel?.classList.toggle('hidden', !hymn.audio);
    if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        if (hymn.audio) audio.src = hymn.audio;
        audio.playbackRate = 1;
        audio.load();
    }
    for (const button of document.querySelectorAll('[data-audio-rate]')) {
        button.classList.toggle('active', button.dataset.audioRate === '1');
    }
    switchMode('letra');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchMode(mode) {
    currentMode = mode;
    for (const button of document.querySelectorAll('[data-hymn-mode]')) {
        button.classList.toggle('active', button.dataset.hymnMode === mode);
    }
    if (mode === 'letra') renderLyricsMode();
    if (mode === 'completar') startCompleteMode();
    if (mode === 'ordem') startOrderMode();
}

function shouldHide(word, sectionIndex, verseIndex, wordIndex) {
    if (!isEligibleWord(word)) return false;
    const score = hash(`${currentHymn.slug}:${memoryRound}:${sectionIndex}:${verseIndex}:${wordIndex}`) % 100;
    return score < (memoryLevel === 1 ? 25 : 50);
}

function wordMarkup(word, sectionIndex, verseIndex, wordIndex) {
    const key = `${sectionIndex}:${verseIndex}:${wordIndex}`;
    if (revealed.has(key) || !shouldHide(word, sectionIndex, verseIndex, wordIndex)) return safeText(word);
    return `<button class="hymn-word-hidden" type="button" data-reveal-word="${key}" aria-label="Tocar para revelar">${safeText(word)}</button>`;
}

function verseMarkup(verse, sectionIndex, verseIndex) {
    const words = verse.split(/\s+/);
    if (memoryLevel === 3) {
        return words.map((word) => `<span class="hymn-word-initial">${safeText(word.charAt(0))}</span>`).join('');
    }
    return words.map((word, wordIndex) => wordMarkup(word, sectionIndex, verseIndex, wordIndex)).join(' ');
}

function lyricsSectionsMarkup() {
    return currentHymn.secoes.map((section, sectionIndex) => `
        <section class="hymn-section">
            <span class="hymn-section-label">${safeText(sectionLabel(section, sectionIndex))}</span>
            ${section.versos.map((verse, verseIndex) => `<p class="hymn-verse">${verseMarkup(verse, sectionIndex, verseIndex)}</p>`).join('')}
        </section>
    `).join('');
}

function renderLyricsMode() {
    if (!currentHymn) return;
    const workspace = one('#hymnWorkspace');
    const memoryBody = memoryLevel === 4
        ? `<div class="hymn-head-memory"><div><strong>Cante de cabeça.</strong><p>Quando terminar, volte ao nível Ler para conferir a letra.</p></div></div>`
        : lyricsSectionsMarkup();
    workspace.innerHTML = `
        <section class="panel hymn-study-panel">
            <div class="hymn-study-head">
                <strong>Escada da memória</strong>
                <span>${memoryLevel > 0 && memoryLevel < 4 ? `${peeks} ${peeks === 1 ? 'espiada' : 'espiadas'}` : ''}</span>
            </div>
            <div class="hymn-memory-levels">
                ${LEVELS.map((level, index) => `
                    <button type="button" data-memory-level="${index}" class="${memoryLevel === index ? 'active' : ''}">
                        <span>${index + 1}</span><small>${safeText(level.label)}</small>
                    </button>
                `).join('')}
            </div>
            <p class="hymn-level-help">${safeText(LEVELS[memoryLevel].help)}</p>
            ${memoryLevel > 0 && memoryLevel < 3 ? '<button class="ui-button quiet-action mini" type="button" data-new-gaps>Trocar lacunas</button>' : ''}
            ${memoryBody}
        </section>
    `;
}

function buildCompleteQuestions() {
    const candidates = [];
    currentHymn.secoes.forEach((section) => section.versos.forEach((verse) => {
        const words = verse.split(/\s+/);
        words.forEach((word, wordIndex) => {
            if (isEligibleWord(word)) candidates.push({ verse, words, word, wordIndex });
        });
    }));
    const selected = shuffled(candidates, `${currentHymn.slug}:complete`).slice(0, Math.min(10, candidates.length));
    const wordPool = [...new Set(candidates.map(({ word }) => word))];
    return selected.map((item, index) => {
        const distractors = shuffled(wordPool.filter((word) => cleanWord(word) !== cleanWord(item.word)), `${currentHymn.slug}:answers:${index}`).slice(0, 3);
        return { ...item, options: shuffled([item.word, ...distractors], `${currentHymn.slug}:options:${index}`) };
    });
}

function startCompleteMode() {
    completeQuestions = buildCompleteQuestions();
    completeIndex = 0;
    completeHits = 0;
    completeLocked = false;
    renderCompleteQuestion();
}

function renderCompleteQuestion() {
    const workspace = one('#hymnWorkspace');
    if (completeIndex >= completeQuestions.length) {
        const score = completeQuestions.length ? Math.round((completeHits / completeQuestions.length) * 100) : 0;
        const previous = Number(readProgress(currentHymn.slug).recordeCompletar || 0);
        saveProgress({ recordeCompletar: Math.max(previous, score) });
        workspace.innerHTML = `
            <section class="panel hymn-finish">
                <span>Treino concluído</span>
                <strong>${completeHits}/${completeQuestions.length}</strong>
                <p>Você acertou ${score}% das palavras.</p>
                <button class="ui-button main-action" type="button" data-complete-restart>Treinar novamente</button>
            </section>
        `;
        return;
    }
    const question = completeQuestions[completeIndex];
    const verse = question.words.map((word, index) => index === question.wordIndex ? '<span class="hymn-complete-blank">________</span>' : safeText(word)).join(' ');
    workspace.innerHTML = `
        <section class="panel hymn-study-panel">
            <div class="hymn-exercise-head"><strong>Complete a palavra</strong><span>${completeIndex + 1} de ${completeQuestions.length} · ${completeHits} certas</span></div>
            <p class="hymn-complete-verse">${verse}</p>
            <div class="hymn-answer-grid">
                ${question.options.map((option) => `<button class="hymn-answer" type="button" data-complete-answer="${safeText(option)}">${safeText(option)}</button>`).join('')}
            </div>
        </section>
    `;
}

function answerComplete(button) {
    if (completeLocked) return;
    completeLocked = true;
    const question = completeQuestions[completeIndex];
    const correct = cleanWord(button.dataset.completeAnswer) === cleanWord(question.word);
    if (correct) completeHits += 1;
    for (const option of document.querySelectorAll('[data-complete-answer]')) {
        const isCorrect = cleanWord(option.dataset.completeAnswer) === cleanWord(question.word);
        option.classList.toggle('correct', isCorrect);
        option.classList.toggle('wrong', option === button && !isCorrect);
        option.disabled = true;
    }
    window.setTimeout(() => {
        completeIndex += 1;
        completeLocked = false;
        renderCompleteQuestion();
    }, 700);
}

function startOrderMode(sectionIndex = 0) {
    orderSection = Math.min(sectionIndex, currentHymn.secoes.length - 1);
    orderPicked = [];
    const verses = currentHymn.secoes[orderSection].versos.map((verse, index) => ({ verse, index }));
    orderRemaining = shuffled(verses, `${currentHymn.slug}:order:${orderSection}:${orderRound}`);
    renderOrderMode();
}

function renderOrderMode(message = '') {
    const workspace = one('#hymnWorkspace');
    workspace.innerHTML = `
        <section class="panel hymn-study-panel">
            <div class="hymn-exercise-head"><strong>Coloque os versos em ordem</strong><span>${orderPicked.length}/${currentHymn.secoes[orderSection].versos.length}</span></div>
            <div class="hymn-section-tabs">
                ${currentHymn.secoes.map((section, index) => `<button type="button" data-order-section="${index}" class="${orderSection === index ? 'active' : ''}">${safeText(sectionLabel(section, index))}</button>`).join('')}
            </div>
            <p class="hymn-level-help">Toque nos versos na ordem em que aparecem no hino.</p>
            ${message ? `<p class="${message === 'Certo!' ? 'success-text' : 'error-text'}">${safeText(message)}</p>` : ''}
            <div class="hymn-order-picked">
                ${orderPicked.length ? orderPicked.map((item, index) => `<span>${index + 1}. ${safeText(item.verse)}</span>`).join('') : '<span>Nenhum verso escolhido ainda.</span>'}
            </div>
            <div class="hymn-order-list">
                ${orderRemaining.map((item) => `<button class="hymn-order-line" type="button" data-order-index="${item.index}">${safeText(item.verse)}</button>`).join('')}
            </div>
            <button class="ui-button quiet-action mini" type="button" data-order-shuffle>Embaralhar novamente</button>
        </section>
    `;
}

function chooseOrder(index) {
    const expected = orderPicked.length;
    const item = orderRemaining.find((candidate) => candidate.index === index);
    if (!item) return;
    if (index !== expected) {
        renderOrderMode('Esse verso ainda não é o próximo. Tente novamente.');
        return;
    }
    orderPicked.push(item);
    orderRemaining = orderRemaining.filter((candidate) => candidate.index !== index);
    if (!orderRemaining.length) {
        const completed = new Set(readProgress(currentHymn.slug).ordemConcluida || []);
        completed.add(orderSection);
        saveProgress({ ordemConcluida: [...completed] });
        renderOrderMode('Certo!');
        return;
    }
    renderOrderMode();
}

function handleClick(event) {
    if (event.target.closest('#hymnBack')) return returnToSelector();

    const mode = event.target.closest('[data-hymn-mode]');
    if (mode) return switchMode(mode.dataset.hymnMode);

    const level = event.target.closest('[data-memory-level]');
    if (level) {
        memoryLevel = Number(level.dataset.memoryLevel);
        revealed = new Set();
        peeks = 0;
        saveProgress({ nivel: memoryLevel });
        return renderLyricsMode();
    }

    const reveal = event.target.closest('[data-reveal-word]');
    if (reveal) {
        revealed.add(reveal.dataset.revealWord);
        peeks += 1;
        return renderLyricsMode();
    }

    if (event.target.closest('[data-new-gaps]')) {
        memoryRound += 1;
        revealed = new Set();
        peeks = 0;
        return renderLyricsMode();
    }

    const answer = event.target.closest('[data-complete-answer]');
    if (answer) return answerComplete(answer);
    if (event.target.closest('[data-complete-restart]')) return startCompleteMode();

    const section = event.target.closest('[data-order-section]');
    if (section) return startOrderMode(Number(section.dataset.orderSection));

    const orderLine = event.target.closest('[data-order-index]');
    if (orderLine) return chooseOrder(Number(orderLine.dataset.orderIndex));

    if (event.target.closest('[data-order-shuffle]')) {
        orderRound += 1;
        return startOrderMode(orderSection);
    }

    if (event.target.closest('[data-audio-back]')) {
        const audio = one('#hymnAudio');
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10);
        return;
    }

    const rate = event.target.closest('[data-audio-rate]');
    if (rate) {
        const value = Number(rate.dataset.audioRate);
        const audio = one('#hymnAudio');
        if (audio) audio.playbackRate = value;
        for (const button of document.querySelectorAll('[data-audio-rate]')) button.classList.toggle('active', button === rate);
    }
}

export async function openHymns() {
    return openSelector();
}

export function bindHymnEvents() {
    one('#hymnPicker')?.addEventListener('click', openSelector);
    one('#hymnModalClose')?.addEventListener('click', closeSelector);
    one('#hymnOptions')?.addEventListener('click', (event) => {
        const option = event.target.closest('[data-hymn-slug]');
        if (option) openHymn(option.dataset.hymnSlug);
    });
    one('#hymnSearch')?.addEventListener('input', (event) => filterSelector(event.target.value));
    one('#hymnModal')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeSelector();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !one('#hymnModal')?.classList.contains('hidden')) closeSelector();
    });
    one('#hymnsView')?.addEventListener('click', handleClick);
    one('#hymnAudio')?.addEventListener('play', () => {
        one('#hymnAudioStatus').textContent = 'Reproduzindo';
    });
    one('#hymnAudio')?.addEventListener('pause', () => {
        one('#hymnAudioStatus').textContent = 'Pausado';
    });
}
