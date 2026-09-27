import { requestJson } from '../../foundation/request.js';
import { accountBadges } from '../../foundation/badges.js';
import { one, safeText, notify } from '../../foundation/selectors.js';

function visibleTotal(value) {
    const total = Math.max(0, Number(value) || 0);
    return total > 99 ? '99+' : String(total);
}

function renderOnline(payload = {}) {
    const real = Math.max(0, Number(payload.online_real) || 0);
    const fake = Math.max(0, Number(payload.online_fake) || 0);
    const total = real + fake;
    one('#adminOnlineReal').textContent = String(real);
    one('#adminOnlineFake').textContent = String(fake);
    one('#adminOnlineTotal').textContent = visibleTotal(total);
    one('#adminOnlineFakeInput').value = String(fake);
    one('#adminOnlineListMeta').textContent = `${real} ${real === 1 ? 'usuário realmente conectado' : 'usuários realmente conectados'}`;
    const users = Array.isArray(payload.usuarios) ? payload.usuarios : [];
    one('#adminOnlineList').innerHTML = users.map((user) => `<article class="admin-online-user">
        <span class="presence-dot" aria-hidden="true"></span><div><strong>${safeText(user.proprio ? 'Você' : user.nome)} ${accountBadges(user)}</strong><small>${safeText(user.perfil === 'supremo' ? 'Desenvolvedor' : user.perfil === 'admin' ? 'Administrador' : 'Aluno')}</small></div>
    </article>`).join('') || '<div class="admin-empty">Nenhum usuário realmente conectado agora.</div>';
}

export async function refreshAdminOnline({ quiet = false } = {}) {
    try {
        renderOnline(await requestJson('admin-online'));
    } catch (error) {
        if (!quiet) notify(error.message);
        throw error;
    }
}

async function saveFakeOnline(value) {
    const fake = Number(value);
    const payload = await requestJson('admin-online', {
        method: 'PUT',
        body: JSON.stringify({ fake_online: fake }),
    });
    renderOnline(payload);
    one('#adminOnlineStatus').textContent = fake
        ? 'Configuração salva. O total público foi atualizado.'
        : 'Online adicional desativado. Apenas usuários reais serão exibidos.';
}

export function bindOnlineManagement() {
    one('#adminOnlineForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = one('#adminOnlineSave');
        button.disabled = true;
        try { await saveFakeOnline(one('#adminOnlineFakeInput').value); }
        catch (error) { notify(error.message); }
        finally { button.disabled = false; }
    });
    one('#adminOnlineClear')?.addEventListener('click', () => saveFakeOnline(0).catch((error) => notify(error.message)));
}
