const fragments = [
    'auth.html',
    'topbar.html',
    'dashboard.html',
    'quiz.html',
    'result.html',
    'history.html',
    'ranking.html',
    'payment.html',
    'admin.html'
];

async function loadFragment(fileName) {
    const response = await fetch(`/views/${fileName}`);

    if (!response.ok) {
        throw new Error(`Não foi possível carregar a interface ${fileName}.`);
    }

    return response.text();
}

export async function mountInterface() {
    const root = document.querySelector('#appRoot');
    const loaded = await Promise.all(fragments.map(loadFragment));
    const [auth, topbar, ...screens] = loaded;

    root.innerHTML = `
        ${auth}
        <div id="appView" class="hidden">
            ${topbar}
            <main class="container">
                <section class="account-plan-strip" aria-label="Seu acesso e planos">
                    <div class="account-plan-controls hidden" id="accountPlanControls">
                        <button class="account-plans-minimal hidden" id="accountPlansBtn" type="button" aria-label="Ver planos e pagamentos">Planos e pagamentos · Renovar / Upgrade.</button>
                    </div>
                    <p class="hidden" id="automaticPaymentNotice" role="status" aria-live="polite"></p>
                </section>
                ${screens.join('\n')}
            </main>
        </div>
        <footer class="install-app-footer hidden" id="installAppFooter" aria-label="Instalação do aplicativo">
            <div class="install-app-compact">
                <button class="install-app-button" id="installAppBtn" type="button" title="Instalar aplicativo" aria-label="Instalar aplicativo">
                    <span class="action-icon" aria-hidden="true">⇩</span>
                    <span>Instalar aplicativo</span>
                </button>
                <button class="install-app-close" id="installAppClose" type="button" title="Fechar" aria-label="Ocultar botão de instalação">×</button>
            </div>
        </footer>
        <aside class="app-update-notice hidden" id="appUpdateNotice" role="status" aria-live="polite">
            <div><strong>Nova versão disponível</strong><span>Atualize agora para usar as melhorias mais recentes.</span></div>
            <button class="ui-button main-action mini" id="applyAppUpdate" type="button">Atualizar</button>
            <button class="update-later" id="dismissAppUpdate" type="button" aria-label="Lembrar depois">Depois</button>
        </aside>
    `;

    // Estas janelas precisam permanecer fora da tela inicial. Durante um
    // simulado, #dashboard fica oculto; mantê-las dentro dele fazia o clique
    // funcionar sem que a janela pudesse aparecer.
    const appView = root.querySelector('#appView');
    for (const id of ['chatModal', 'supportModal', 'topicsModal', 'notificationsModal', 'missionsModal']) {
        const modal = root.querySelector(`#${id}`);
        if (modal) appView?.append(modal);
    }
}
