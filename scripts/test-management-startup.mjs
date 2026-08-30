import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

let role = null;
const notices = [];
let loads = 0;
const elements = new Map();
const one = (id) => {
    if (!elements.has(id)) {
        const classes = new Set();
        elements.set(id, { classList: {
            add: (name) => classes.add(name),
            contains: (name) => classes.has(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
        } });
    }
    return elements.get(id);
};
const context = vm.createContext({ console });
const route = new vm.SourceTextModule(await readFile(new URL('../public/app/domains/management.js', import.meta.url),'utf8'), { context });
const exportsByFile = {
    'selectors.js': { one, all:()=>[], notify:(message)=>notices.push(message) },
    'model.js': { appState:{} },
    'catalog.js': { refreshCatalog:async()=>{} },
    'common.js': { bindAdminModalClosers:()=>{}, isManager:()=>['admin','supremo'].includes(role), isSupreme:()=>role==='supremo' },
    'users.js': { bindUserManagement:()=>{}, refreshManagedUsers:async()=>{ loads++; } },
    'content.js': { bindContentManagement:()=>{}, refreshAdminCatalog:async()=>{ loads++; }, renderManagedCatalog:()=>{} },
    'questions.js': { bindQuestionManagement:()=>{}, refreshAdminQuestions:async()=>{ loads++; } },
    'transfer.js': { bindTransferManagement:()=>{} },
    'maintenance.js': { bindMaintenanceManagement:()=>{} },
    'overview.js': { refreshAdminOverview:async()=>{ loads++; } },
    'payments.js': { bindPaymentManagement:()=>{}, refreshAdminPayments:async()=>{ loads++; } },
};
await route.link((spec) => {
    const exports = exportsByFile[spec.split('/').at(-1)];
    return new vm.SyntheticModule(Object.keys(exports),function(){
        for (const [name,value] of Object.entries(exports)) this.setExport(name,value);
    }, { context });
});
await route.evaluate();
const { applyManagementAccess, activateAdminPanel, openManagementWorkspace } = route.namespace;
for (role of [null,'aluno']) {
    applyManagementAccess();
    await openManagementWorkspace();
    assert.equal(notices.length, 0);
    assert.equal(loads, 0);
    assert(one('#adminView').classList.contains('hidden'));
    assert(one('#navAdmin').classList.contains('hidden'));
}
await activateAdminPanel('usersPanel');
assert.equal(notices.length, 1); // Explicit unauthorized access is still rejected.
assert.equal(loads, 0);
role = 'admin';
applyManagementAccess();
assert.equal(notices.length, 1);
await activateAdminPanel('usersPanel');
assert.equal(loads, 1);
await activateAdminPanel('maintenancePanel');
assert.equal(notices.length, 2);
assert.equal(loads, 1);
role = 'supremo';
applyManagementAccess();
await activateAdminPanel('maintenancePanel');
assert.equal(loads, 2);
role = 'aluno';
applyManagementAccess();
assert.equal(notices.length, 2);
assert(one('#maintenancePanel').classList.contains('hidden'));
const main = await readFile(new URL('../public/app/main.js',import.meta.url),'utf8');
assert(!main.includes('appStartup'));
console.log('Inicialização: aluno sem aviso, acesso administrativo protegido e abertura removida.');
