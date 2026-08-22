import { requestJson } from '../foundation/request.js';
import { one } from '../foundation/selectors.js';
import { appState } from '../foundation/model.js';

export function showIdentityMode(mode) {
    const loginMode = mode === 'login';

    one('#loginForm').classList.toggle('hidden', !loginMode);
    one('#signupForm').classList.toggle('hidden', loginMode);
    one('#showLogin').classList.toggle('active', loginMode);
    one('#showSignup').classList.toggle('active', !loginMode);
}

export function bindIdentityEvents(onAuthenticated) {
    one('#showLogin').addEventListener('click', () => showIdentityMode('login'));
    one('#showSignup').addEventListener('click', () => showIdentityMode('signup'));

    one('#loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        one('#loginError').textContent = '';

        try {
            const data = await requestJson('login', {
                method: 'POST',
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
                body: JSON.stringify({
                    nome: one('#signupName').value,
                    usuario: one('#signupUser').value,
                    senha: one('#signupPass').value
                })
            });

            event.target.reset();
            one('#signupError').classList.add('success-message');
            one('#signupError').textContent = data.mensagem || 'Cadastro enviado. Aguarde aprovação de um administrador.';
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
