import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

let user = { id:'student', acesso_questoes:true };
let rateAllowed = true;
let session = { id:'session', questoes_ids:[10,11], finalizada_em:null };
let existing = null;
let inserted = 0;
const context = vm.createContext({ console, Number });
const modules = new Map();
function mock(name, exports) {
    modules.set(name, new vm.SyntheticModule(Object.keys(exports), function() {
        for (const [key,value] of Object.entries(exports)) this.setExport(key,value);
    }, { context, identifier:name }));
}
mock('auth.mjs', { requireUser:async()=>user });
mock('http.mjs', {
    json:(statusCode,body,headers={})=>({statusCode,body,headers}),
    parseBody:event=>JSON.parse(event.body || '{}'),
});
mock('question-access.mjs', { questionAccessDeniedResponse:()=>({erro:'bloqueado'}) });
mock('rate-limit.mjs', { consumeRateLimit:async()=>({allowed:rateAllowed,unavailable:false}) });
mock('db.mjs', { db:()=>({ from:(table)=>{
    const query = {
        select:()=>query,
        eq:()=>query,
        maybeSingle:async()=>({
            data: table === 'sessoes' ? session : table === 'respostas' ? existing : null,
            error:null,
        }),
        single:async()=> table === 'questoes'
            ? {data:{resposta_correta:1,resolucao:'R',alternativas:['A','B'],ativo:true},error:null}
            : {data:null,error:null},
        insert:async()=>{inserted++;return {error:null};},
    };
    return query;
} }) });
const responder = new vm.SourceTextModule(
    await readFile(new URL('../server/routes/responder.mjs', import.meta.url),'utf8'),
    { context, identifier:'responder.mjs' },
);
await responder.link(spec=>modules.get(spec.split('/').at(-1)));
await responder.evaluate();
const call = body=>responder.namespace.handler({httpMethod:'POST',body:JSON.stringify(body)});

assert.equal((await call({questao_id:10,resposta_marcada:1})).statusCode,400);
assert.equal((await call({sessao_id:'session',questao_id:99,resposta_marcada:1})).statusCode,403);
existing={id:1};
assert.equal((await call({sessao_id:'session',questao_id:10,resposta_marcada:1})).statusCode,409);
existing=null;
assert.equal((await call({sessao_id:'session',questao_id:10,resposta_marcada:5})).statusCode,400);
const accepted=await call({sessao_id:'session',questao_id:10,resposta_marcada:1});
assert.equal(accepted.statusCode,200);
assert.equal(accepted.body.correta,1);
assert.equal(inserted,1);
session={...session,finalizada_em:new Date().toISOString()};
assert.equal((await call({sessao_id:'session',questao_id:10,resposta_marcada:1})).statusCode,403);
session={id:'session',questoes_ids:[10],finalizada_em:null};
rateAllowed=false;
assert.equal((await call({sessao_id:'session',questao_id:10,resposta_marcada:1})).statusCode,429);
rateAllowed=true; user={id:'student',acesso_questoes:false};
assert.equal((await call({sessao_id:'session',questao_id:10,resposta_marcada:1})).statusCode,403);
user=null;
assert.equal((await call({sessao_id:'session',questao_id:10,resposta_marcada:1})).statusCode,401);

const sessionsSource = await readFile(new URL('../server/routes/sessoes.mjs',import.meta.url),'utf8');
assert(sessionsSource.includes('questoes_ids: questionIds'));
assert(sessionsSource.includes(".select('acertou,pulada')"));
assert(!sessionsSource.includes('respondidas: body.respondidas'));
const userAdminSource = await readFile(new URL('../server/routes/admin-users.mjs',import.meta.url),'utf8');
const paymentAdminSource = await readFile(new URL('../server/routes/admin-payments.mjs',import.meta.url),'utf8');
assert(userAdminSource.includes('responsavel_admin_id.eq.${actor.id},and(responsavel_admin_id.is.null,perfil.eq.aluno,vip.eq.false)'));
assert(userAdminSource.includes('target.responsavel_admin_id === actor.id'));
assert(paymentAdminSource.includes('target.responsavel_admin_id === actor.id'));
assert(paymentAdminSource.includes("paymentQuery.in('usuario_id', allowedUserIds)"));
const vercel = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const csp = vercel.headers.flatMap(item=>item.headers).find(item=>item.key==='Content-Security-Policy').value;
assert(!csp.includes("'unsafe-inline'"));
assert(csp.includes('https://cdn.sheetjs.com'));
const migration = await readFile(new URL('../supabase/migration-v4.24-seguranca-integridade.sql',import.meta.url),'utf8');
assert(migration.includes('auditoria_admin'));
assert(migration.includes('revoke execute on function public.preencher_snapshot_resposta()'));
console.log('Segurança v4.24: gabarito, sessão, ranking, responsabilidade, CSP e auditoria passaram.');
