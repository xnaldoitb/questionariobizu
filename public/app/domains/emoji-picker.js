import { notify, one, safeText } from '../foundation/selectors.js';

const MAX_CHAT_GRAPHEMES = 400;
const RECENT_KEY = 'quiz-openmoji-recentes';

const EMOJI_GROUPS = [
    {
        id: 'rostos', label: 'Rostos', icon: '😊', items: [
            ['😀', '1F600', 'sorrindo'], ['😃', '1F603', 'feliz'], ['😄', '1F604', 'alegre'],
            ['😁', '1F601', 'sorriso'], ['😆', '1F606', 'risada'], ['😅', '1F605', 'alívio'],
            ['😂', '1F602', 'lágrimas de alegria'], ['🤣', '1F923', 'gargalhada'], ['😊', '1F60A', 'sorrindo tímido'],
            ['😇', '1F607', 'anjo'], ['🙂', '1F642', 'sorriso leve'], ['🙃', '1F643', 'de cabeça para baixo'],
            ['😉', '1F609', 'piscando'], ['😍', '1F60D', 'apaixonado'], ['🥰', '1F970', 'carinhoso'],
            ['😘', '1F618', 'beijo'], ['😎', '1F60E', 'óculos escuros'], ['🤔', '1F914', 'pensando'],
            ['😮', '1F62E', 'surpreso'], ['😢', '1F622', 'triste'], ['😭', '1F62D', 'chorando'],
            ['😡', '1F621', 'bravo'],
        ],
    },
    {
        id: 'gestos', label: 'Gestos', icon: '👍', items: [
            ['👍', '1F44D', 'positivo'], ['👎', '1F44E', 'negativo'], ['👏', '1F44F', 'aplausos'],
            ['🙌', '1F64C', 'comemoração'], ['👋', '1F44B', 'aceno'], ['🤝', '1F91D', 'aperto de mãos'],
            ['🙏', '1F64F', 'agradecimento'], ['💪', '1F4AA', 'força'], ['🤞', '1F91E', 'boa sorte'],
            ['✌️', '270C', 'vitória'], ['👌', '1F44C', 'perfeito'], ['🫶', '1FAF6', 'mãos coração'],
        ],
    },
    {
        id: 'simbolos', label: 'Símbolos', icon: '❤️', items: [
            ['❤️', '2764', 'coração vermelho'], ['💛', '1F49B', 'coração amarelo'], ['💚', '1F49A', 'coração verde'],
            ['💙', '1F499', 'coração azul'], ['💜', '1F49C', 'coração roxo'], ['🖤', '1F5A4', 'coração preto'],
            ['💔', '1F494', 'coração partido'], ['🔥', '1F525', 'fogo'], ['⭐', '2B50', 'estrela'],
            ['✨', '2728', 'brilhos'], ['💯', '1F4AF', 'cem pontos'], ['✅', '2705', 'confirmado'],
            ['❌', '274C', 'cancelado'], ['⚠️', '26A0', 'atenção'], ['🎯', '1F3AF', 'alvo'],
        ],
    },
    {
        id: 'estudos', label: 'Estudos', icon: '📚', items: [
            ['📚', '1F4DA', 'livros'], ['📖', '1F4D6', 'livro aberto'], ['📝', '1F4DD', 'anotação'],
            ['✏️', '270F', 'lápis'], ['💡', '1F4A1', 'ideia'], ['🎓', '1F393', 'formatura'],
            ['🏆', '1F3C6', 'troféu'], ['🥇', '1F947', 'medalha'], ['🚀', '1F680', 'foguete'],
            ['🎉', '1F389', 'festa'], ['🎊', '1F38A', 'confete'], ['👮', '1F46E', 'policial'],
            ['🚔', '1F694', 'viatura'], ['🚨', '1F6A8', 'sirene'], ['🇧🇷', '1F1E7-1F1F7', 'bandeira do Brasil'],
        ],
    },
];

const ALL_EMOJIS = EMOJI_GROUPS.flatMap((group) => group.items);
const BY_EMOJI = new Map(ALL_EMOJIS.map((item) => [item[0], item]));

export function countGraphemes(value) {
    const text = String(value ?? '');
    if (globalThis.Intl?.Segmenter) {
        return [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(text)].length;
    }
    return Array.from(text).length;
}

function recentItems() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
            .map((emoji) => BY_EMOJI.get(emoji))
            .filter(Boolean)
            .slice(0, 16);
    } catch {
        return [];
    }
}

function remember(emoji) {
    const recent = [emoji, ...recentItems().map((item) => item[0]).filter((item) => item !== emoji)].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function insertEmoji(item) {
    const input = one('#chatInput');
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = `${input.value.slice(0, start)}${item[0]}${input.value.slice(end)}`;
    if (countGraphemes(next) > MAX_CHAT_GRAPHEMES) {
        notify(`A mensagem pode ter no máximo ${MAX_CHAT_GRAPHEMES} caracteres.`);
        return;
    }
    input.value = next;
    const caret = start + item[0].length;
    input.focus();
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    remember(item[0]);
}

function renderItems(items) {
    const grid = one('#emojiGrid');
    if (!grid) return;
    grid.innerHTML = items.length ? items.map(([emoji, code, label]) => `
        <button class="openmoji-item" type="button" data-emoji="${safeText(emoji)}" title="${safeText(label)}" aria-label="${safeText(label)}">
            <img src="/assets/openmoji/${safeText(code)}.svg" alt="" loading="lazy" width="32" height="32">
        </button>
    `).join('') : '<p class="openmoji-empty">Nenhum emoji encontrado.</p>';
}

function activateCategory(categoryId) {
    const recent = recentItems();
    const group = EMOJI_GROUPS.find((item) => item.id === categoryId) || EMOJI_GROUPS[0];
    document.querySelectorAll('[data-emoji-category]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.emojiCategory === categoryId);
    });
    renderItems(categoryId === 'recentes' ? recent : group.items);
}

export function bindEmojiPicker() {
    const toggle = one('#emojiToggle');
    const picker = one('#emojiPicker');
    if (!toggle || !picker) return;

    const tabs = one('#emojiCategories');
    tabs.innerHTML = [
        ['recentes', 'Recentes', '◷'],
        ...EMOJI_GROUPS.map((group) => [group.id, group.label, group.icon]),
    ].map(([id, label, icon]) => `
        <button type="button" data-emoji-category="${id}" title="${label}" aria-label="${label}">${icon}</button>
    `).join('');

    const open = () => {
        picker.classList.remove('hidden');
        toggle.setAttribute('aria-expanded', 'true');
        const initial = recentItems().length ? 'recentes' : 'rostos';
        activateCategory(initial);
        one('#emojiSearch').value = '';
        one('#emojiSearch').focus();
    };
    const close = () => {
        picker.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => picker.classList.contains('hidden') ? open() : close());
    one('#emojiClose').addEventListener('click', close);
    tabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-emoji-category]');
        if (button) activateCategory(button.dataset.emojiCategory);
    });
    one('#emojiGrid').addEventListener('click', (event) => {
        const button = event.target.closest('[data-emoji]');
        const item = BY_EMOJI.get(button?.dataset.emoji);
        if (item) insertEmoji(item);
    });
    one('#emojiSearch').addEventListener('input', (event) => {
        const query = event.currentTarget.value.trim().toLocaleLowerCase('pt-BR');
        if (!query) return activateCategory('rostos');
        document.querySelectorAll('[data-emoji-category]').forEach((button) => button.classList.remove('is-active'));
        renderItems(ALL_EMOJIS.filter(([emoji, , label]) => emoji.includes(query) || label.includes(query)));
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !picker.classList.contains('hidden')) close();
    });
}
