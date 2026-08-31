import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
    'public/index.html',
    'public/views/auth.html',
    'public/views/topbar.html',
    'public/views/dashboard.html',
    'public/views/quiz.html',
    'public/views/admin.html',
    'public/views/payment.html',
    'public/app/main.js',
    'public/app/foundation/request.js',
    'public/app/foundation/badges.js',
    'public/app/foundation/pwa.js',
    'public/app/domains/study.js',
    'public/app/domains/management.js',
    'public/app/domains/community.js',
    'public/app/domains/access.js',
    'public/app/domains/admin/common.js',
    'public/app/domains/admin/users.js',
    'public/app/domains/admin/content.js',
    'public/app/domains/admin/questions.js',
    'public/app/domains/admin/transfer.js',
    'public/app/domains/admin/maintenance.js',
    'public/app/domains/admin/overview.js',
    'public/app/domains/admin/payments.js',
    'public/manifest.webmanifest',
    'public/service-worker.js',
    'public/assets/icons/icon-192.png',
    'public/assets/icons/icon-512.png',
    'public/assets/icons/icon-maskable-512.png',
    'public/styles/10-pwa-brand.css',
    'api/[...route].js',
    'server/platform/auth.mjs',
    'server/platform/access-validity.mjs',
    'server/platform/community.mjs',
    'server/platform/question-access.mjs',
    'server/platform/admin-audit.mjs',
    'server/platform/payments.mjs',
    'server/routes/login.mjs',
    'server/routes/presenca.mjs',
    'server/routes/chat.mjs',
    'server/routes/admin-users.mjs',
    'server/routes/admin-catalogo.mjs',
    'server/routes/admin-questions.mjs',
    'server/routes/admin-backup.mjs',
    'server/routes/admin-maintenance.mjs',
    'server/routes/pagamento-criar.mjs',
    'server/routes/pagamento-status.mjs',
    'server/routes/pagamento-webhook.mjs',
    'server/routes/planos.mjs',
    'server/routes/admin-payments.mjs',
    'supabase/schema.sql',
    'supabase/migration-admin-2.0-validade-usuarios.sql',
    'supabase/migration-v4.3-vip-auditoria-ranking.sql',
    'supabase/migration-v4.24-seguranca-integridade.sql',
    'supabase/migration-v4.25-dois-dispositivos-filtro-adm.sql',
    'supabase/migration-v4.4-insignias-ranking.sql',
    'supabase/migration-v4.6-presenca-chat-temporario.sql',
    'supabase/migration-v4.7-teste-30min-acesso-vencido.sql',
    'supabase/migration-v4.8-pagamentos-pix-whatsapp.sql',
    'supabase/migration-v4.9-planos-pagamentos-admin.sql',
    'supabase/migration-v4.10-premium-vip-planos.sql',
    'supabase/migration-v4.11-saldo-mercado-pago.sql',
    'supabase/migration-v4.17-protecao-cadastros.sql',
    'supabase/migration-v4.18-sessao-mesmo-dispositivo.sql',
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
const identityModule = await readFile('public/app/domains/identity.js', 'utf8');
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
const communityModule = await readFile('public/app/domains/community.js', 'utf8');
const communityCss = await readFile('public/styles/08-community-compact.css', 'utf8');
const migration46 = await readFile('supabase/migration-v4.6-presenca-chat-temporario.sql', 'utf8');
const presenceRoute = await readFile('server/routes/presenca.mjs', 'utf8');
const chatRoute = await readFile('server/routes/chat.mjs', 'utf8');
const accessModule = await readFile('public/app/domains/access.js', 'utf8');
const accessCss = await readFile('public/styles/09-trial-access.css', 'utf8');
const questionAccess = await readFile('server/platform/access-policy.mjs', 'utf8');
const migration47 = await readFile('supabase/migration-v4.7-teste-30min-acesso-vencido.sql', 'utf8');
const cadastro = await readFile('server/routes/cadastro.mjs', 'utf8');
const questoesRoute = await readFile('server/routes/questoes.mjs', 'utf8');
const responderRoute = await readFile('server/routes/responder.mjs', 'utf8');
const paymentView = await readFile('public/views/payment.html', 'utf8');
const paymentPlatform = await readFile('server/platform/payments.mjs', 'utf8');
const paymentCreate = await readFile('server/routes/pagamento-criar.mjs', 'utf8');
const paymentWebhook = await readFile('server/routes/pagamento-webhook.mjs', 'utf8');
const migration48 = await readFile('supabase/migration-v4.8-pagamentos-pix-whatsapp.sql', 'utf8');
const migration49 = await readFile('supabase/migration-v4.9-planos-pagamentos-admin.sql', 'utf8');
const migration410 = await readFile('supabase/migration-v4.10-premium-vip-planos.sql', 'utf8');
const migration411 = await readFile('supabase/migration-v4.11-saldo-mercado-pago.sql', 'utf8');
const paymentStatus = await readFile('server/routes/pagamento-status.mjs', 'utf8');
const adminPaymentsRoute = await readFile('server/routes/admin-payments.mjs', 'utf8');
const manifest = await readFile('public/manifest.webmanifest', 'utf8');
const serviceWorker = await readFile('public/service-worker.js', 'utf8');
const pwaModule = await readFile('public/app/foundation/pwa.js', 'utf8');
const pwaBrand = await readFile('public/styles/10-pwa-brand.css', 'utf8');
const fragments = await readFile('public/app/foundation/fragments.js', 'utf8');

const adminModules = {
    management: await readFile('public/app/domains/management.js', 'utf8'),
    users: await readFile('public/app/domains/admin/users.js', 'utf8'),
    content: await readFile('public/app/domains/admin/content.js', 'utf8'),
    questions: await readFile('public/app/domains/admin/questions.js', 'utf8'),
    transfer: await readFile('public/app/domains/admin/transfer.js', 'utf8'),
    maintenance: await readFile('public/app/domains/admin/maintenance.js', 'utf8'),
    overview: await readFile('public/app/domains/admin/overview.js', 'utf8'),
    payments: await readFile('public/app/domains/admin/payments.js', 'utf8'),
};

const requiredPanels = [
    'overviewPanel',
    'usersPanel',
    'paymentsPanel',
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
    'public/app/domains/community.js',
    'public/app/domains/access.js',
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

if (!migration.includes('validade_ate') || !auth.includes('resolveQuestionAccess') || !login.includes('resolveQuestionAccess')) {
    throw new Error('A separação entre login e acesso às questões da v4.7 está incompleta.');
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

for (const marker of ['PREMIUM', 'VIP', 'ADM', 'DESENVOLVEDOR']) {
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


if (!quizView.includes('id="answerFeedback"')) {
    throw new Error('Feedback de acerto/erro v4.5.1 ausente no questionário.');
}

for (const marker of ["correctRow?.classList.remove('is-eliminated')", 'Você acertou!', 'Você errou.']) {
    if (!studyModule.includes(marker)) {
        throw new Error(`Lógica v4.5.1 ausente: ${marker}`);
    }
}

for (const marker of ['answer-feedback.is-correct', 'answer-feedback.is-wrong', 'var(--success-surface)']) {
    if (!visualCss.includes(marker)) {
        throw new Error(`Estilo v4.5.1 ausente: ${marker}`);
    }
}

for (const marker of ['onlineCount', 'onlineSpotlight', 'openChatBtn', 'chatModal', 'chatMessages']) {
    if (!dashboardView.includes(marker)) {
        throw new Error(`Interface de comunidade v4.6 ausente: ${marker}`);
    }
}

for (const marker of ['startCommunity', 'sendActivityPing', 'refreshPresence', 'refreshChat']) {
    if (!communityModule.includes(marker)) {
        throw new Error(`Lógica de comunidade v4.6 ausente: ${marker}`);
    }
}

for (const marker of ['presencas_online', 'chat_temporario']) {
    if (!migration46.includes(marker)) {
        throw new Error(`Migration v4.6 incompleta: ${marker}`);
    }
}

if (!apiRouter.includes("['presenca', presenca]") || !apiRouter.includes("['chat', chat]")) {
    throw new Error('Rotas de presença/chat v4.6 não estão registradas.');
}

if (!presenceRoute.includes('cleanupCommunity') || !chatRoute.includes('chat-temporario')) {
    throw new Error('Proteções do chat temporário v4.6 estão incompletas.');
}

for (const marker of ['community-strip', 'chat-modal', 'profile-dashboard .profile-metric']) {
    if (!communityCss.includes(marker)) {
        throw new Error(`Estilo v4.6 ausente: ${marker}`);
    }
}


for (const marker of ['acesso_teste', 'teste_expira_em: null', 'após entrar', '8 horas']) {
    if (!cadastro.includes(marker)) {
        throw new Error(`Cadastro de teste v4.21 incompleto: ${marker}`);
    }
}

for (const marker of ['TESTE_ATIVO', 'TESTE_EXPIRADO', 'ACESSO_VENCIDO']) {
    if (!questionAccess.includes(marker)) {
        throw new Error(`Regra de acesso v4.7 incompleta: ${marker}`);
    }
}

if (!questoesRoute.includes('user.acesso_questoes') || !responderRoute.includes('user.acesso_questoes')) {
    throw new Error('Bloqueio server-side de questões/respostas v4.7 está incompleto.');
}

if (!studyModule.includes("question.tipo === 'certo_errado'") || !studyModule.includes("trueFalseQuestion ? ''")) {
    throw new Error('Questões de Certo/Errado ainda exibem a ferramenta de eliminação.');
}

for (const marker of ['accessNotice', 'accessBlockedCard']) {
    if (!dashboardView.includes(marker) && !quizView.includes(marker)) {
        throw new Error(`Interface de acesso v4.7 ausente: ${marker}`);
    }
}

for (const marker of ['renderAccessNotice', 'renderAccessBlocked', 'refreshAccessState']) {
    if (!accessModule.includes(marker)) {
        throw new Error(`Lógica visual de acesso v4.7 ausente: ${marker}`);
    }
}

for (const marker of ['access-notice', 'access-blocked-card', 'answer-row.no-elimination']) {
    if (!accessCss.includes(marker)) {
        throw new Error(`Estilo v4.7 ausente: ${marker}`);
    }
}

for (const marker of ['acesso_teste', 'teste_expira_em', 'desativado_por_validade']) {
    if (!migration47.includes(marker)) {
        throw new Error(`Migration v4.7 incompleta: ${marker}`);
    }
}

for (const route of ['pagamento-criar', 'pagamento-status', 'pagamento-webhook', 'planos', 'admin-payments']) {
    if (!routeNames.has(route)) throw new Error(`Rota de pagamento ausente: ${route}`);
}

for (const marker of ['whatsapp', 'pagamentos', 'confirmar_pagamento_pix']) {
    if (!migration48.includes(marker)) throw new Error(`Migration v4.8 incompleta: ${marker}`);
}

if (!paymentPlatform.includes('excluded_payment_types') || !paymentWebhook.includes('validateWebhookSignature')) {
    throw new Error('Proteções da integração Pix v4.8 estão incompletas.');
}

for (const marker of ['planos_acesso', 'conceder_acesso_plano', 'aplicar_periodo_acesso']) {
    if (!migration49.includes(marker)) throw new Error(`Migration v4.9 incompleta: ${marker}`);
}

for (const marker of ['manual_grant', 'generate_charge', 'save_plan']) {
    if (!adminPaymentsRoute.includes(marker) || !adminModules.payments.includes(marker)) {
        throw new Error(`Gestão de pagamentos v4.9 incompleta: ${marker}`);
    }
}

for (const marker of ['premium', 'aplicar_periodo_acesso', 'ranking_usuarios']) {
    if (!migration410.includes(marker)) throw new Error(`Migration v4.10 incompleta: ${marker}`);
}
if (!badges.includes('else if (premium)') || !auth.includes('premiumAtivo')) {
    throw new Error('Regras Premium/VIP v4.10 incompletas.');
}

if (!migration411.includes("p_meio_pagamento not in ('pix', 'account_money')") || !paymentStatus.includes('reconcilePayment')) {
    throw new Error('Reconciliação de pagamentos por saldo v4.11 incompleta.');
}

if (!index.includes('manifest.webmanifest') || !adminView || !manifest.includes('"display": "standalone"')) {
    throw new Error('Manifesto de instalação PWA v4.12 incompleto.');
}
if (!serviceWorker.includes("pathname.startsWith('/api/')") || !pwaModule.includes('beforeinstallprompt')) {
    throw new Error('Instalação e cache seguro PWA v4.12 incompletos.');
}
if (index.includes('appStartup') || pwaBrand.includes('app-startup')) {
    throw new Error('A tela de abertura personalizada deve permanecer removida.');
}
if (!fragments.includes('id="installAppFooter"') || !fragments.includes('id="installAppBtn"')) {
    throw new Error('Rodapé global de instalação v4.16 incompleto.');
}

if (!pwaBrand.includes('.install-app-footer') || !pwaBrand.includes('position: fixed') || !pwaModule.includes('pwa-install-available')) {
    throw new Error('Comportamento responsivo do rodapé de instalação v4.16 incompleto.');
}

const migration417 = await readFile('supabase/migration-v4.17-protecao-cadastros.sql', 'utf8');
const cadastroRoute = await readFile('server/routes/cadastro.mjs', 'utf8');
const rateLimitModule = await readFile('server/platform/rate-limit.mjs', 'utf8');

for (const marker of ['cadastro_device_hash', 'proteger_whatsapp_usuario', 'pg_advisory_xact_lock']) {
    if (!migration417.includes(marker)) throw new Error(`Proteção de cadastros v4.17 incompleta: ${marker}`);
}
for (const marker of ['cadastro-ip-dia', 'cadastro-dispositivo', 'cadastro-whatsapp', 'form_started_at']) {
    if (!cadastroRoute.includes(marker)) throw new Error(`Defesa da rota de cadastro v4.17 incompleta: ${marker}`);
}
if (!rateLimitModule.includes('failClosed') || !rateLimitModule.includes("createHash('sha256')")) {
    throw new Error('Rate limit seguro v4.17 incompleto.');
}

const migration418 = await readFile('supabase/migration-v4.18-sessao-mesmo-dispositivo.sql', 'utf8');
for (const marker of ['sessao_ativa_device_hash', 'p_device_hash text', 'sessao_ativa_device_hash = p_device_hash']) {
    if (!migration418.includes(marker)) throw new Error(`Sessão por dispositivo v4.18 incompleta: ${marker}`);
}
if (!login.includes('p_device_hash: deviceHash') || !identityModule.includes("headers: { 'x-client-device': clientDeviceToken() }")) {
    throw new Error('Renovação de login no mesmo dispositivo v4.18 incompleta.');
}

console.log('Questionário Bizu v4.30.0: verificações estruturais concluídas.');
