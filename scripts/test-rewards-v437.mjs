import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const nodes = new Map();
const documentEvents = new Map();
const bodyClasses = new Set();
const calls = [];

function node(selector) {
    if (!nodes.has(selector)) {
        const classes = new Set(['#rewardModal', '#paymentModal'].includes(selector) ? ['hidden'] : []);
        nodes.set(selector, {
            textContent: '',
            events: new Map(),
            classList: {
                add: (...items) => items.forEach((item) => classes.add(item)),
                remove: (...items) => items.forEach((item) => classes.delete(item)),
                contains: (item) => classes.has(item),
            },
            addEventListener(name, handler) { this.events.set(name, handler); },
        });
    }
    return nodes.get(selector);
}

const requestJson = async (endpoint, options = {}) => {
    calls.push({ endpoint, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (!options.method) return { premio: {
        id: 'd93b2f92-cd67-4df5-9cc3-18b8bd0aebd2',
        plano: 'trimestral',
        plano_nome: 'Trimestral',
        mensagem: 'Seu esforço foi reconhecido.',
    } };
    return { ok: true };
};

const document = {
    body: { classList: { add: (item) => bodyClasses.add(item), remove: (item) => bodyClasses.delete(item) } },
    addEventListener: (name, handler) => documentEvents.set(name, handler),
};
const context = vm.createContext({ document, console, JSON });
const requestModule = new vm.SyntheticModule(['requestJson'], function () { this.setExport('requestJson', requestJson); }, { context });
const selectorsModule = new vm.SyntheticModule(['one'], function () { this.setExport('one', node); }, { context });
const rewardsModule = new vm.SourceTextModule(await readFile('public/app/domains/rewards.js', 'utf8'), { context });
await rewardsModule.link((specifier) => specifier.endsWith('request.js') ? requestModule : selectorsModule);
await rewardsModule.evaluate();

rewardsModule.namespace.bindRewardEvents();
await rewardsModule.namespace.checkRewardNotification();
assert(!node('#rewardModal').classList.contains('hidden'));
assert.equal(node('#rewardMessage').textContent, 'Seu esforço foi reconhecido.');
assert.equal(node('#rewardPlan').textContent, 'Trimestral');
assert(bodyClasses.has('modal-open'));

node('#rewardContinue').events.get('click')();
await new Promise((resolve) => setImmediate(resolve));
assert(node('#rewardModal').classList.contains('hidden'));
assert(calls.some((call) => call.method === 'POST' && call.body?.premio_id === 'd93b2f92-cd67-4df5-9cc3-18b8bd0aebd2'));

const [migration, adminRoute, adminUi, apiRouter, css, access, main] = await Promise.all([
    readFile('supabase/migration-v4.37-premiacao.sql', 'utf8'),
    readFile('server/routes/admin-payments.mjs', 'utf8'),
    readFile('public/app/domains/admin/payments.js', 'utf8'),
    readFile('api/[...route].js', 'utf8'),
    readFile('public/styles/09-trial-access.css', 'utf8'),
    readFile('public/app/domains/access.js', 'utf8'),
    readFile('public/app/main.js', 'utf8'),
]);
for (const marker of ['premios_usuario', 'premiar_usuario_plano', "origem = 'premio'", 'visualizado_em']) {
    assert(migration.includes(marker), `Migração de premiação sem ${marker}`);
}
assert(adminRoute.includes("action === 'award_plan'") && adminRoute.includes("rpc('premiar_usuario_plano'"));
assert(adminUi.includes("adminPaymentAction('award_plan')"));
assert(apiRouter.includes("['premio', premio]"));
assert(css.includes('#paymentModal.modal-overlay') && css.includes('#rewardModal.modal-overlay'));
assert(css.includes('align-items: center !important'));
assert(css.includes('@media (prefers-reduced-motion: reduce)'));
assert(access.includes('paymentPlansCache') && access.includes('paymentPlansPromise'));
assert(main.includes('preloadPaymentPlans().catch'));

console.log('Premiação v4.37: concessão, aviso único, animação acessível e modais centralizados passaram.');
