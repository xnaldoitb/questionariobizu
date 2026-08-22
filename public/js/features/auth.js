import { api } from '../core/api.js';
import { $ } from '../core/dom.js';
import { state } from '../core/state.js';

export function setAuthMode(mode) {
    const loginMode = mode === 'login';

    $('#loginForm').classList.toggle('hidden', !loginMode);
    $('#signupForm').classList.toggle('hidden', loginMode);
    $('#showLogin').classList.toggle('active', loginMode);
    $('#showSignup').classList.toggle('active', !loginMode);
}

export function bindAuthEvents(onAuthenticated) {
    $('#showLogin').addEventListener('click', () => setAuthMode('login'));
    $('#showSignup').addEventListener('click', () => setAuthMode('signup'));

    $('#loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        $('#loginError').textContent = '';

        try {
            const data = await api('login', {
                method: 'POST',
                body: JSON.stringify({
                    usuario: $('#loginUser').value,
                    senha: $('#loginPass').value
                })
            });

            state.user = data.usuario;
            await onAuthenticated();
        } catch (error) {
            $('#loginError').textContent = error.message;
        }
    });

    $('#signupForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        $('#signupError').textContent = '';

        if ($('#signupPass').value !== $('#signupConfirm').value) {
            $('#signupError').textContent = 'As senhas não coincidem.';
            return;
        }

        try {
            const data = await api('cadastro', {
                method: 'POST',
                body: JSON.stringify({
                    nome: $('#signupName').value,
                    usuario: $('#signupUser').value,
                    senha: $('#signupPass').value
                })
            });

            event.target.reset();
            $('#signupError').classList.add('success-message');
            $('#signupError').textContent = data.mensagem || 'Cadastro enviado. Aguarde aprovação de um administrador.';
        } catch (error) {
            $('#signupError').classList.remove('success-message');
            $('#signupError').textContent = error.message;
        }
    });

    $('#logoutBtn').addEventListener('click', async () => {
        await api('logout', { method: 'POST' });
        window.location.reload();
    });
}

export async function restoreSession() {
    const data = await api('me');
    state.user = data.usuario;
}
