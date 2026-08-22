const fragments = [
    'auth.html',
    'topbar.html',
    'dashboard.html',
    'quiz.html',
    'result.html',
    'history.html',
    'ranking.html',
    'admin.html'
];

async function loadFragment(fileName) {
    const response = await fetch(`/views/${fileName}?v=20260818-v4.3`, {
        cache: 'no-store'
    });

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
                ${screens.join('\n')}
            </main>
        </div>
    `;
}
