const componentFiles = [
    'auth.html',
    'topbar.html',
    'dashboard.html',
    'quiz.html',
    'result.html',
    'history.html',
    'ranking.html',
    'admin.html'
];

async function fetchComponent(fileName) {
    const response = await fetch(`/components/${fileName}?v=20260815-1`, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`Não foi possível carregar o componente ${fileName}.`);
    }

    return response.text();
}

export async function loadApplicationComponents() {
    const root = document.querySelector('#appRoot');
    const fragments = await Promise.all(componentFiles.map(fetchComponent));

    const [auth, topbar, ...views] = fragments;

    root.innerHTML = `
        ${auth}
        <div id="appView" class="hidden">
            ${topbar}
            <main class="container">
                ${views.join('\n')}
            </main>
        </div>
    `;
}
