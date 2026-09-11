import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
let actor = { id:'admin',perfil:'admin' };
const target = { id:'student',perfil:'aluno',ativo:true,status_aprovacao:'aprovado',vip:false,acesso_teste:true,responsavel_admin_id:'admin' };
let saved;
let gifted;
let giftNotification;
const context = vm.createContext({Date,JSON,Boolean,String,Number,Set,Map,console});
const modules = new Map();
let loginLimitCleared = false;
function mock(name,exports) { const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context,identifier:name});modules.set(name,m); }
mock('bcryptjs',{default:{hash:async()=> 'test-hash'}});
mock('node:crypto',{randomUUID:()=> '00000000-0000-4000-8000-000000000047'});
mock('auth.mjs',{requireUser:async()=>actor});
mock('question-access.mjs',{resolveQuestionAccess:()=>({})});
mock('admin-audit.mjs',{auditAdmin:async()=>true});
mock('rate-limit.mjs',{clearRateLimit:async()=>{loginLimitCleared=true;}});
mock('xp.mjs',{awardXp:async(id,key,type,points,details)=>{gifted={id,key,type,points,details};return {applied:true,xpTotal:points};}});
mock('notifications.mjs',{createNotification:async(record)=>{giftNotification=record;}});
mock('admin-permissions.mjs',{
    canManageAdminTarget:(currentActor,currentTarget)=>currentActor.perfil==='supremo'||currentTarget.responsavel_admin_id===currentActor.id,
    claimUnassignedAdminTarget:async()=>true,
});
mock('db.mjs',{db:()=>({from:()=>{
    const q = {select:()=>q,eq:()=>q,neq:()=>q,in:()=>q,delete:()=>q,maybeSingle:async()=>({data:target,error:null}),
        update:payload=>{saved=payload;return q;},insert:payload=>{saved=payload;return q;},
        single:async()=>({data:saved,error:null}),then:resolve=>resolve({error:null})}; return q;
}})});
for(const [name,path] of [['http.mjs','platform/http.mjs'],['access-validity.mjs','platform/access-validity.mjs'],['admin-users.mjs','routes/admin-users.mjs']]){
    modules.set(name,new vm.SourceTextModule(await readFile(new URL(`../server/${path}`,import.meta.url),'utf8'),{context,identifier:name}));
}
const route=modules.get('admin-users.mjs');
await route.link(spec=>modules.get(spec.split('/').at(-1)));
await route.evaluate();
const call=async(method,body)=>route.namespace.handler({httpMethod:method,queryStringParameters:{},body:JSON.stringify(body)});
const date=new Date(Date.now()+86400000).toISOString();
assert.equal((await call('POST',{usuario:'9999',nome:'Teste',senha:'12345',validade_ate:date})).statusCode,400);
assert.equal((await call('POST',{usuario:'9999',nome:'Teste',senha:'123456',validade_ate:date})).statusCode,201);
assert.equal(saved.premium,true);
assert.equal(saved.vip,false);
assert.equal((await call('PUT',{id:target.id,action:'set_validity',validade_ate:date})).statusCode,200);
assert.equal(saved.premium,true);
assert.equal(saved.sessao_ativa_id,undefined); // no forced logout on grant
assert.equal((await call('PUT',{id:target.id,action:'set_validity',validade_ate:null})).statusCode,200);
assert.equal(saved.premium,false);
assert.equal(saved.teste_saldo_segundos,0);
assert(saved.teste_ciclo_em);
assert.equal((await call('PUT',{id:target.id,action:'set_validity',vitalicio:true})).statusCode,200);
assert.equal(saved.vip,true);
target.vip=true;
assert.equal((await call('PUT',{id:target.id,action:'set_validity',validade_ate:date})).statusCode,200);
assert.equal(saved.vip,false);
actor.perfil='supremo';
const giftResponse=await call('PUT',{id:target.id,action:'gift_xp',pontos:750,motivo:'Destaque nos estudos'});
assert.equal(giftResponse.statusCode,200);
assert.equal(gifted.points,750);
assert.equal(gifted.type,'presente');
assert.equal(giftNotification.usuario_id,target.id);
assert(giftNotification.mensagem.includes('750 XP'));
assert.equal((await call('PUT',{id:target.id,action:'set_validity',vitalicio:true})).statusCode,200);
assert.equal(saved.vip,true);
assert.equal(saved.premium,false);
assert.equal(saved.validade_ate,null);
assert.equal((await call('PUT',{id:target.id,action:'end_sessions'})).statusCode,200);
assert.equal(saved.sessao_ativa_id,null);
assert.equal(loginLimitCleared,true);
target.vip=false;
assert.equal((await call('PUT',{id:target.id,action:'promote_admin'})).statusCode,200);
assert.equal(saved.perfil,'admin');
assert.equal(saved.vip,true);
assert.equal(saved.plano_atual,'vitalicio');
assert.equal(saved.validade_ate,null);
assert.equal(saved.acesso_teste,false);
console.log('ADM: gestão de alunos e promoção com acesso vitalício automático passaram (banco simulado).');
