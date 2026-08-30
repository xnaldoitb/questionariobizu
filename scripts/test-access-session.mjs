import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// Executes the real frontend modules with a simulated DOM/network/clock.
let now = Date.now();
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const nodes = new Map();
const windowEvents = new Map();
const documentEvents = new Map();
const timers = new Map();
let timerId = 0;
const calls = [];
let paid = false;
let accountOverride = {};
const user = () => ({ id:'test', nome:'Aluno', perfil:'aluno', premium:paid, vip:false, acesso_teste:!paid, acesso_questoes:paid,
    acesso_codigo:paid?'ACESSO_ATIVO':'TESTE_EXPIRADO', acesso_restante_ms:0, validade_ate:paid?new Date(now+86400000).toISOString():null, ...accountOverride });
const appState = { user:user() };
function node(id) {
    if (!nodes.has(id)) {
        const classes = new Set(id === '#paymentModal' ? ['hidden'] : []);
        nodes.set(id, { textContent:'', innerHTML:'', events:new Map(),
            classList:{add:(...x)=>x.forEach(v=>classes.add(v)), remove:(...x)=>x.forEach(v=>classes.delete(v)), contains:x=>classes.has(x), toggle:(x,force)=>{const add=force??!classes.has(x);if(add)classes.add(x);else classes.delete(x);return add;}},
            addEventListener(name,fn) { this.events.set(name,fn); }, querySelector:() => node('#icon'),
        });
    }
    return nodes.get(id);
}
const requestJson = async (endpoint, options={}) => {
    calls.push({ endpoint, body:options.body?JSON.parse(options.body):null });
    if (endpoint==='pagamento-status') return {usuario:user(),pendencias:paid?0:1,consulta:{falhas:0,confirmados:paid?1:0}};
    if (endpoint==='planos') return {planos:[]};
    return {usuario:user()};
};
const document = {visibilityState:'visible', addEventListener:(name,fn)=>documentEvents.set(name,fn), dispatchEvent:()=>{}};
const context = vm.createContext({ Date:Clock, URLSearchParams, CustomEvent:class {}, console, document,
    fetch:async (url,options)=>{calls.push({endpoint:url,body:JSON.parse(options.body)});return {};},
    clearInterval:id=>timers.delete(id),
    window:{location:{search:'',pathname:'/'},history:{replaceState:()=>{}},
        addEventListener:(name,fn)=>windowEvents.set(name,fn),setInterval:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},
    },
});
const modules = new Map();
function synthetic(id, exports) {
    const m = new vm.SyntheticModule(Object.keys(exports), function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context,identifier:id});
    modules.set(id,m); return m;
}
synthetic('request.js',{requestJson});
synthetic('model.js',{appState});
synthetic('selectors.js',{one:node,safeText:String});
synthetic('navigation.js',{openScreen:()=>{}});
for (const name of ['session-activity.js','access.js']) {
    modules.set(name,new vm.SourceTextModule(await readFile(new URL(`../public/app/domains/${name}`,import.meta.url),'utf8'),{context,identifier:name}));
}
const access = modules.get('access.js');
await access.link(spec=>modules.get(spec.split('/').at(-1)));
await access.evaluate();
const flush = async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
access.namespace.bindPaymentEvents();
access.namespace.startAccessIndicator();
await flush();
assert(calls.some(c=>c.endpoint==='pagamento-status'));
assert(calls.some(c=>c.endpoint==='acesso-atividade'&&c.body.ativo));
assert(node('#paymentModal').classList.contains('hidden'));
assert.match(node('#automaticPaymentNotice').textContent,/cobrança/);
assert(!calls.some(c=>c.endpoint==='pagamento-criar'));
paid=true;
now+=31000;
[...timers.values()].find(t=>t.ms===30000).fn();
await flush();
assert.equal(appState.user.premium,true);
assert(node('#paymentModal').classList.contains('hidden'));
access.namespace.openPaymentPlans(); await flush();
node('#paymentClose').events.get('click')();
assert([...timers.values()].some(t=>t.ms===30000));
assert(!calls.some(c=>c.endpoint==='pagamento-criar'));
// Idle pauses; interacting resumes. Neither process starts another purchase.
now+=125000;
[...timers.values()].find(t=>t.ms===20000).fn(); await flush();
assert(calls.some(c=>c.endpoint==='acesso-atividade'&&c.body.ativo===false));
windowEvents.get('pointerdown')(); await flush();
assert.equal(calls.at(-1).body.ativo,true);
document.visibilityState='hidden'; documentEvents.get('visibilitychange')(); await flush();
assert.equal(calls.at(-1).body.ativo,false);
document.visibilityState='visible';
for (const account of [{perfil:'admin'}, {perfil:'supremo'}, {vip:true}, {acesso_tipo:'vitalicio'}]) {
    accountOverride=account;
    await access.namespace.refreshAccessState();
    assert(node('#accountPlansBtn').classList.contains('hidden'));
    assert(node('#accountPlanControls').classList.contains('hidden'));
    assert(node('#accessNoticePlans').classList.contains('hidden'));
    assert(node('#blockedPlansBtn').classList.contains('hidden'));
    access.namespace.openPaymentPlans();
    assert(node('#paymentModal').classList.contains('hidden'));
}
accountOverride={};
await access.namespace.refreshAccessState();
assert(!node('#accountPlansBtn').classList.contains('hidden'));
assert([...timers.values()].some(t=>t.ms===30000));
console.log('Sessão: consultas sem modal, Premium automático, pausa/retomada, zero compras involuntárias passaram (DOM/API simulados).');
console.log('Botão Planos: oculto para ADM/Desenvolvedor/vitalício, visível para aluno Premium; consultas mantidas.');
