import { requestJson } from '../foundation/request.js';
import { one } from '../foundation/selectors.js';
import { appState } from '../foundation/model.js';

let signupStartedAt = Date.now();
let volatileDeviceToken = null;

function clientDeviceToken() {
    const storageKey = 'questionario_bizu_device';
    let token = volatileDeviceToken;

    try {
        token = localStorage.getItem(storageKey) || token;
    } catch {
        // Alguns navegadores bloqueiam o armazenamento no modo privado.
    }

    if (!token) {
        token = globalThis.crypto?.randomUUID?.()
            || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        volatileDeviceToken = token;
        try {
            localStorage.setItem(storageKey, token);
        } catch {
            // Mantém o identificador apenas durante esta sessão.
        }
    }

    return token;
}

export function showIdentityMode(mode) {
    const loginMode = mode === 'login';

    one('#loginForm').classList.toggle('hidden', !loginMode);
    one('#signupForm').classList.toggle('hidden', loginMode);
    one('#showLogin').classList.toggle('active', loginMode);
    one('#showSignup').classList.toggle('active', !loginMode);
    if (!loginMode) signupStartedAt = Date.now();
}

export function bindIdentityEvents(onAuthenticated) {
    one('#showLogin').addEventListener('click', () => showIdentityMode('login'));
    one('#showSignup').addEventListener('click', () => showIdentityMode('signup'));

    one('#signupWhatsapp').addEventListener('input', (event) => {
        const digits = event.target.value.replace(/\D/g, '').replace(/^55/, '').slice(0, 11);
        const ddd = digits.slice(0, 2);
        const first = digits.length > 10 ? digits.slice(2, 7) : digits.slice(2, 6);
        const last = digits.length > 10 ? digits.slice(7) : digits.slice(6);
        event.target.value = [ddd && `(${ddd})`, first, last && `-${last}`].filter(Boolean).join(' ');
    });

    one('#loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        one('#loginError').textContent = '';

        try {
            const data = await requestJson('login', {
                method: 'POST',
                headers: { 'x-client-device': clientDeviceToken() },
                body: JSON.stringify({
                    usuario: one('#loginUser').value,
                    senha: one('#loginPass').value
                })
            });

            appState.user = data.usuario;
            await onAuthenticated();
        } catch (error) {
            one('#loginError').textContent = error.message;
        }
    });

    one('#signupForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        one('#signupError').textContent = '';

        if (one('#signupPass').value !== one('#signupConfirm').value) {
            one('#signupError').textContent = 'As senhas não coincidem.';
            return;
        }

        try {
            const data = await requestJson('cadastro', {
                method: 'POST',
                headers: { 'x-client-device': clientDeviceToken() },
                body: JSON.stringify({
                    nome: one('#signupName').value,
                    usuario: one('#signupUser').value,
                    whatsapp: `55${one('#signupWhatsapp').value.replace(/\D/g, '').replace(/^55/, '')}`,
                    senha: one('#signupPass').value,
                    website: one('#signupWebsite').value,
                    form_started_at: signupStartedAt
                })
            });

            event.target.reset();
            one('#signupError').classList.add('success-message');
            one('#signupError').textContent = data.mensagem || 'Conta criada. Seu teste começa após entrar e usar o site.';

            // Mantém a mensagem visível por alguns instantes e leva o usuário ao login,
            // O teste só será iniciado na sessão autenticada.
            window.setTimeout(() => {
                showIdentityMode('login');
                one('#loginUser').value = data.usuario?.usuario || '';
                one('#loginPass').focus();
            }, 2200);
        } catch (error) {
            one('#signupError').classList.remove('success-message');
            one('#signupError').textContent = error.message;
        }
    });

    one('#logoutBtn').addEventListener('click', async () => {
        await requestJson('logout', { method: 'POST' });
        window.location.reload();
    });
}

export async function recoverIdentity() {
    const data = await requestJson('me');
    appState.user = data.usuario;
}
