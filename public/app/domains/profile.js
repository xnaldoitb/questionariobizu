import { requestJson } from '../foundation/request.js';
import { accountBadges } from '../foundation/badges.js';
import { appState } from '../foundation/model.js';
import { one, safeText, notify } from '../foundation/selectors.js';

function closeProfile() {
    one('#profileModal')?.classList.add('hidden');
    if (!one('.modal-overlay:not(.hidden)')) document.body.classList.remove('modal-open');
    one('#openProfileBtn')?.focus({ preventScroll: true });
}

function openProfile() {
    const user = appState.user || {};
    one('#profileNameInput').value = user.nome || '';
    one('#profileLoginInput').value = user.usuario || '';
    one('#profileWhatsappInput').value = user.whatsapp || '';
    one('#profileCurrentPassword').value = '';
    one('#profileNewPassword').value = '';
    one('#profileConfirmPassword').value = '';
    one('#profileFormStatus').textContent = '';
    one('#profileModal')?.classList.remove('hidden');
    document.body.classList.add('modal-open');
    one('#profileNameInput')?.focus({ preventScroll: true });
}

async function saveProfile(event) {
    event.preventDefault();
    const button = one('#profileSave');
    const status = one('#profileFormStatus');
    const nextPassword = one('#profileNewPassword').value;
    if (nextPassword !== one('#profileConfirmPassword').value) {
        status.textContent = 'As novas senhas não coincidem.';
        return;
    }
    button.disabled = true;
    status.textContent = 'Salvando…';
    try {
        const response = await requestJson('perfil', {
            method: 'PUT',
            body: JSON.stringify({
                nome: one('#profileNameInput').value,
                whatsapp: one('#profileWhatsappInput').value,
                senha_atual: one('#profileCurrentPassword').value,
                nova_senha: nextPassword,
            }),
        });
        appState.user = { ...appState.user, ...response.usuario };
        one('#profileWarName').innerHTML = `${safeText(appState.user.nome)} ${accountBadges(appState.user)}`;
        one('#profileRegistration').textContent = `AL SD PM Nº: ${appState.user.usuario}`;
        closeProfile();
        notify(response.senha_alterada ? 'Perfil e senha atualizados.' : 'Perfil atualizado.');
    } catch (error) {
        status.textContent = error.message;
    } finally {
        button.disabled = false;
    }
}

export function bindProfileEvents() {
    one('#openProfileBtn')?.addEventListener('click', openProfile);
    one('#profileModalClose')?.addEventListener('click', closeProfile);
    one('#profileModal')?.addEventListener('click', (event) => { if (event.target === event.currentTarget) closeProfile(); });
    one('#profileForm')?.addEventListener('submit', saveProfile);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !one('#profileModal')?.classList.contains('hidden')) closeProfile();
    });
}
