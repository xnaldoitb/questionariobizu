import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
let actor = { id:'admin',perfil:'admin' };
const target = { id:'student',perfil:'aluno',ativo:true,status_aprovacao:'aprovado',vip:false,acesso_teste:true,responsavel_admin_id:'admin' };
let saved;
const context = vm.createContext({Date,JSON,Boolean,String,Number,Set,Map,console});
const modules = new Map();
function mock(name,exports) { const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context,identifier:name});modules.set(name,m); }
mock('bcryptjs',{default:{hash:async()=> 'test-hash'}});
mock('auth.mjs',{requireUser:async()=>actor});
mock('question-access.mjs',{resolveQuestionAccess:()=>({})});
mock('admin-audit.mjs',{auditAdmin:async()=>true});
mock('db.mjs',{db:()=>({from:()=>{
    const q = {select:()=>q,eq:()=>q,neq:()=>q,in:()=>q,maybeSingle:async()=>({data:target,error:null}),
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
assert.equal((await call('PUT',{id:target.id,action:'set_validity',vitalicio:true})).statusCode,200);
assert.equal(saved.vip,true);
assert.equal(saved.premium,false);
assert.equal(saved.validade_ate,null);
console.log('ADM: criação/edição Premium e controle integral de VIP próprio passaram (banco simulado).');
