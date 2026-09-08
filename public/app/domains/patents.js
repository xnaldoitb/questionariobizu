import { requestJson } from '../foundation/request.js';
import { one } from '../foundation/selectors.js';
import { ADMIN_PATENT, DEVELOPER_PATENT, patentForHits, patentInsigniaMarkup, patentProgress } from '../foundation/patents.js';

let notificationOpen = false;
let checking = false;
let postponed = false;

function anotherPriorityModalIsOpen() {
    return one('#rewardModal')?.classList.contains('hidden') === false
        || one('#paymentModal')?.classList.contains('hidden') === false;
}

function renderPatentModal({ hits = 0, papirao = false, developer = false, admin = false, achievement = false } = {}) {
    const progress = patentProgress(hits);
    const modal = one('#patentModal');
    if (!modal) return;

    one('#patentModalKicker').textContent = developer || admin
        ? 'PATENTE INSTITUCIONAL'
        : papirao
        ? (achievement ? 'CONQUISTA ESPECIAL' : 'LIDERANÇA DO RANKING')
        : (achievement ? 'NOVA PATENTE' : 'SUA EVOLUÇÃO');
    one('#patentModalTitle').textContent = developer ? DEVELOPER_PATENT.name : admin ? ADMIN_PATENT.name : papirao ? 'PAPIRÃO' : progress.current.name;
    one('#patentModalIcon').innerHTML = papirao
        ? '<span class="patent-modal-crown"><img src="/assets/icons/coroa-papirao.svg" alt="Coroa PAPIRÃO"></span>'
        : patentInsigniaMarkup(hits, { decorative: true, developer, admin });
    one('#patentModalDescription').textContent = developer
        ? DEVELOPER_PATENT.meaning
        : admin
        ? ADMIN_PATENT.meaning
        : papirao
        ? `Você alcançou a liderança. Sua patente permanente é ${progress.current.name}.`
        : progress.current.meaning;
    one('#patentModalHits').textContent = String(progress.hits);
    one('#patentModalCurrent').textContent = developer ? DEVELOPER_PATENT.name : admin ? ADMIN_PATENT.name : progress.current.name;
    one('#patentModalNext').textContent = developer
        ? 'Exclusiva do Desenvolvedor'
        : admin
        ? 'Exclusiva dos administradores'
        : progress.next
        ? `${progress.remaining} acertos para ${progress.next.name}`
        : 'Patente máxima alcançada';
    const progressValue = developer || admin ? 100 : progress.progress;
    one('#patentProgressBar').style.width = `${progressValue}%`;
    one('#patentProgressBar').parentElement?.setAttribute('aria-valuenow', String(progressValue));
    one('#patentContinue').textContent = achievement ? 'Continuar' : 'Fechar';
    modal.classList.toggle('is-achievement', achievement);
    modal.classList.toggle('is-papirao', papirao);
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    one('#patentContinue')?.focus();
}

function closePatentModal() {
    const acknowledge = notificationOpen;
    notificationOpen = false;
    one('#patentModal')?.classList.add('hidden');
    if (!document.querySelector('.modal-overlay:not(.hidden)')) document.body.classList.remove('modal-open');
    if (acknowledge) requestJson('patente', { method: 'POST', body: '{}' }).catch(() => {});
}

function openPatentFromButton(button) {
    notificationOpen = false;
    renderPatentModal({
        hits: Number(button.dataset.patentHits || 0),
        papirao: button.dataset.papirao === 'true',
        developer: button.dataset.developer === 'true',
        admin: button.dataset.admin === 'true',
        achievement: false,
    });
}

export function bindPatentEvents() {
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-patent-detail]');
        if (trigger) openPatentFromButton(trigger);
    });
    one('#patentClose')?.addEventListener('click', closePatentModal);
    one('#patentContinue')?.addEventListener('click', closePatentModal);
    one('#patentModal')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closePatentModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !one('#patentModal')?.classList.contains('hidden')) closePatentModal();
    });
    ['quiz:reward-closed', 'quiz:payment-closed'].forEach((name) => {
        document.addEventListener(name, () => {
            if (!postponed) return;
            postponed = false;
            checkPatentNotification();
        });
    });
}

export async function checkPatentNotification() {
    if (checking || notificationOpen) return false;
    if (anotherPriorityModalIsOpen()) {
        postponed = true;
        return false;
    }
    checking = true;
    try {
        const data = await requestJson('patente');
        if (!data.notificar_patente && !data.notificar_papirao) return false;
        if (anotherPriorityModalIsOpen()) {
            postponed = true;
            return false;
        }
        notificationOpen = true;
        renderPatentModal({
            hits: data.patente?.acertos || 0,
            papirao: Boolean(data.notificar_papirao),
            achievement: true,
        });
        return true;
    } catch {
        // O aviso permanece pendente no servidor para a próxima entrada.
        return false;
    } finally {
        checking = false;
    }
}
