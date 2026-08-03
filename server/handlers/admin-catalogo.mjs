import { db } from '../lib/db.mjs'; import { requireUser } from '../lib/auth.mjs'; import { json,parseBody } from '../lib/http.mjs';
export const handler=async(event)=>{
 if(!(await requireUser(event,'admin'))) return json(403,{erro:'Acesso restrito.'}); const b=parseBody(event),p=event.queryStringParameters||{};
 if(event.httpMethod==='POST'){
  if(b.tipo==='disciplina'){const id=String(b.id||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-');if(!id||!b.nome)return json(400,{erro:'Informe código e nome.'});const {data,error}=await db().from('disciplinas').insert({id,nome:b.nome,descricao:b.descricao||null,ordem:Number(b.ordem)||0,ativo:true}).select().single();return error?json(400,{erro:error.message}):json(201,{item:data});}
  if(b.tipo==='capitulo'){const {data:mx}=await db().from('capitulos').select('indice').eq('disciplina_id',b.disciplina_id).order('indice',{ascending:false}).limit(1);const {data,error}=await db().from('capitulos').insert({disciplina_id:b.disciplina_id,indice:Number(b.indice)||((mx?.[0]?.indice||0)+1),nome:b.nome,ativo:true}).select().single();return error?json(400,{erro:error.message}):json(201,{item:data});}
 }
 if(event.httpMethod==='DELETE'){
  if(p.tipo==='disciplina'){const {error}=await db().from('disciplinas').update({ativo:false}).eq('id',p.id);return error?json(400,{erro:error.message}):json(200,{ok:true});}
  if(p.tipo==='capitulo'){const {error}=await db().from('capitulos').update({ativo:false}).eq('id',Number(p.id));return error?json(400,{erro:error.message}):json(200,{ok:true});}
 }
 return json(405,{erro:'Método não permitido.'});
};
