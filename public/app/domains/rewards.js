import { requestJson } from '../foundation/request.js';
import { one } from '../foundation/selectors.js';

let currentReward = null;
let loadingReward = false;

function closeReward() {
    const reward = currentReward;
    currentReward = null;
    one('#rewardModal')?.classList.add('hidden');
    if (one('#paymentModal')?.classList.contains('hidden') !== false) document.body?.classList.remove('modal-open');
    if (typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent('quiz:reward-closed'));
    if (!reward?.id) return;
    requestJson('premio', {
        method: 'POST',
        body: JSON.stringify({ premio_id: reward.id }),
    }).catch(() => {});
}

export function bindRewardEvents() {
    one('#rewardClose')?.addEventListener('click', closeReward);
    one('#rewardContinue')?.addEventListener('click', closeReward);
    one('#rewardModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'rewardModal') closeReward();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !one('#rewardModal')?.classList.contains('hidden')) closeReward();
    });
}

export async function checkRewardNotification() {
    if (loadingReward || currentReward) return Boolean(currentReward);
    loadingReward = true;
    try {
        const data = await requestJson('premio');
        if (!data.premio) return false;
        currentReward = data.premio;
        one('#rewardMessage').textContent = data.premio.mensagem;
        one('#rewardPlan').textContent = data.premio.plano_nome;
        one('#rewardModal').classList.remove('hidden');
        document.body?.classList.add('modal-open');
        return true;
    } catch {
        // A premiação continua pendente para a próxima entrada.
    } finally {
        loadingReward = false;
    }
    return false;
}
