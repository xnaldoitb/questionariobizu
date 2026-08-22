import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
    'public/index.html',
    'public/views/auth.html',
    'public/views/topbar.html',
    'public/views/dashboard.html',
    'public/views/quiz.html',
    'public/views/admin.html',
    'public/app/main.js',
    'public/app/foundation/request.js',
    'public/app/foundation/badges.js',
    'public/app/domains/study.js',
    'public/app/domains/management.js',
    'public/app/domains/admin/common.js',
    'public/app/domains/admin/users.js',
    'public/app/domains/admin/content.js',
    'public/app/domains/admin/questions.js',
    'public/app/domains/admin/transfer.js',
    'public/app/domains/admin/maintenance.js',
    'public/app/domains/admin/overview.js',
    'api/[...route].js',
    'server/platform/auth.mjs',
    'server/platform/access-validity.mjs',
    'server/routes/login.mjs',
    'server/routes/admin-users.mjs',
    'server/routes/admin-catalogo.mjs',
    'server/routes/admin-questions.mjs',
    'server/routes/admin-backup.mjs',
    'server/routes/admin-maintenance.mjs',
    'supabase/schema.sql',
    'supabase/migration-admin-2.0-validade-usuarios.sql',
    'supabase/migration-v4.3-vip-auditoria-ranking.sql',
    'supabase/migration-v4.4-insignias-ranking.sql',
];

for (const file of requiredFiles) {
    await access(file);
}

const index = await readFile('public/index.html', 'utf8');
if (!index.includes('id="appRoot"')) {
    throw new Error('O ponto de montagem #appRoot não foi encontrado.');
}
if (!index.includes('/app/main.js')) {
    throw new Error('A entrada modular do frontend não foi encontrada.');
}

const adminView = await readFile('public/views/admin.html', 'utf8');
const apiRouter = await readFile('api/[...route].js', 'utf8');
const auth = await readFile('server/platform/auth.mjs', 'utf8');
const login = await readFile('server/routes/login.mjs', 'utf8');
const migration = await readFile('supabase/migration-admin-2.0-validade-usuarios.sql', 'utf8');
const migration43 = await readFile('supabase/migration-v4.3-vip-auditoria-ranking.sql', 'utf8');
const migration44 = await readFile('supabase/migration-v4.4-insignias-ranking.sql', 'utf8');
const badges = await readFile('public/app/foundation/badges.js', 'utf8');
const dashboardView = await readFile('public/views/dashboard.html', 'utf8');
const quizView = await readFile('public/views/quiz.html', 'utf8');
const studyModule = await readFile('public/app/domains/study.js', 'utf8');
const visualCss = await readFile('public/styles/07-pmpa-moderno-minimalista.css', 'utf8');
const rankingRoute = await readFile('server/routes/ranking.mjs', 'utf8');
const importRoute = await readFile('server/routes/admin-import.mjs', 'utf8');

const adminModules = {
    management: await readFile('public/app/domains/management.js', 'utf8'),
    users: await readFile('public/app/domains/admin/users.js', 'utf8'),
    content: await readFile('public/app/domains/admin/content.js', 'utf8'),
    questions: await readFile('public/app/domains/admin/questions.js', 'utf8'),
    transfer: await readFile('public/app/domains/admin/transfer.js', 'utf8'),
    maintenance: await readFile('public/app/domains/admin/maintenance.js', 'utf8'),
    overview: await readFile('public/app/domains/admin/overview.js', 'utf8'),
};

const requiredPanels = [
    'overviewPanel',
    'usersPanel',
    'contentPanel',
    'questionsPanel',
    'transferPanel',
    'maintenancePanel',
];
for (const id of requiredPanels) {
    if (!adminView.includes(`id="${id}"`)) {
        throw new Error(`Painel administrativo ausente: #${id}`);
    }
}

const controlBindings = [
    ['refreshUsers', 'users'],
    ['userForm', 'users'],
    ['validityForm', 'users'],
    ['disciplineForm', 'content'],
    ['chapterForm', 'content'],
    ['refreshCatalogAdmin', 'content'],
    ['questionForm', 'questions'],
    ['questionRefreshBtn', 'questions'],
    ['analyzeImportBtn', 'transfer'],
    ['importBtn', 'transfer'],
    ['exportBtn', 'transfer'],
    ['exportExcelBtn', 'transfer'],
    ['backupContentBtn', 'transfer'],
    ['endSessionsBtn', 'maintenance'],
    ['clearResultsBtn', 'maintenance'],
    ['purgeSelectedDisciplineBtn', 'maintenance'],
    ['deleteAllDisciplinesBtn', 'maintenance'],
];

for (const [id, moduleName] of controlBindings) {
    if (!adminView.includes(`id="${id}"`)) {
        throw new Error(`Controle administrativo ausente: #${id}`);
    }
    if (!adminModules[moduleName].includes(`#${id}`)) {
        throw new Error(`Controle #${id} sem ligação no módulo ${moduleName}.`);
    }
}

const routeNames = new Set(
    [...apiRouter.matchAll(/\['([^']+)',\s*\w+\]/g)].map((match) => match[1]),
);

for (const requiredRoute of [
    'admin-users',
    'admin-catalogo',
    'admin-questions',
    'admin-import',
    'admin-export',
    'admin-backup',
    'admin-maintenance',
]) {
    if (!routeNames.has(requiredRoute)) {
        throw new Error(`Rota administrativa não registrada: ${requiredRoute}`);
    }
}

const frontendFiles = [
    'public/app/domains/identity.js',
    'public/app/domains/catalog.js',
    'public/app/domains/study.js',
    'public/app/domains/performance.js',
    'public/app/domains/management.js',
    'public/app/domains/admin/users.js',
    'public/app/domains/admin/content.js',
    'public/app/domains/admin/questions.js',
    'public/app/domains/admin/transfer.js',
    'public/app/domains/admin/maintenance.js',
    'public/app/domains/admin/overview.js',
];

for (const file of frontendFiles) {
    const source = await readFile(file, 'utf8');
    if (source.includes('/requestJson/')) {
        throw new Error(`URL inválida /requestJson/ encontrada em ${file}.`);
    }

    const calls = [...source.matchAll(/requestJson\(\s*['"`]([^'"`]+)['"`]/g)];
    for (const [, endpoint] of calls) {
        const route = endpoint.split(/[?${]/, 1)[0].replace(/^\/+/, '');
        if (route && !routeNames.has(route)) {
            throw new Error(`Rota frontend não registrada: ${route} (${file})`);
        }
    }
}

if (!adminModules.transfer.includes('/api/admin-export?disciplina=')) {
    throw new Error('Exportação JSON/Excel não está ligada à rota /api/admin-export.');
}
if (!adminModules.transfer.includes("fetch('/api/admin-backup'")) {
    throw new Error('Backup geral não está ligado à rota /api/admin-backup.');
}

if (!migration.includes('validade_ate') || !auth.includes('isAccessExpired') || !login.includes('isAccessExpired')) {
    throw new Error('A proteção de validade da Administração 2.0 está incompleta.');
}



for (const control of ['newUserResponsible', 'newUserVip', 'editUserResponsible', 'editUserVip']) {
    if (!adminView.includes(`id="${control}"`)) {
        throw new Error(`Controle v4.3 ausente: #${control}`);
    }
}

if (!dashboardView.includes('id="reviewPendingOnly"')) {
    throw new Error('Filtro de revisão inteligente ausente no simulado.');
}

for (const marker of ['responsavel_admin_id', 'aprovado_por_admin_id', 'criado_por_admin_id', 'vip', 'substituir_disciplina_completa', 'questao_enunciado']) {
    if (!migration43.includes(marker)) {
        throw new Error(`Migration v4.3 incompleta: ${marker}`);
    }
}

if (!rankingRoute.includes("from('respostas')") || !rankingRoute.includes('ranking_usuarios')) {
    throw new Error('Ranking imediato v4.3 não está configurado.');
}

for (const marker of ['PREMIUM', 'VIP', 'ADM', 'SUPREMO']) {
    if (!badges.includes(marker)) {
        throw new Error(`Insígnia v4.4 ausente: ${marker}`);
    }
}

if (!migration44.includes('u.perfil') || !rankingRoute.includes('perfil,vip')) {
    throw new Error('Perfil do usuário não está disponível para as insígnias do ranking v4.4.');
}

if (!importRoute.includes("rpc('substituir_disciplina_completa'")) {
    throw new Error('Substituição definitiva e transacional v4.3 não está configurada.');
}

for (const marker of ['confirmAnswerBtn', 'answer-tools-hint']) {
    if (!quizView.includes(marker)) {
        throw new Error(`Controle v4.5 ausente no questionário: ${marker}`);
    }
}

for (const marker of ['selectedAnswerIndex', 'toggleEliminatedAnswer', 'confirmSelectedAnswer', 'answer-eliminate']) {
    if (!studyModule.includes(marker)) {
        throw new Error(`Lógica v4.5 ausente: ${marker}`);
    }
}

for (const marker of ['answer-row.is-eliminated', 'confirm-answer-action', 'profile-dashboard .account-insignia']) {
    if (!visualCss.includes(marker)) {
        throw new Error(`Estilo v4.5 ausente: ${marker}`);
    }
}

console.log('Questionário Bizu v4.5.0: estrutura, insígnias com contraste, eliminação de alternativas, confirmação explícita, VIP, revisão, ranking imediato e substituição definitiva validados com sucesso.');
