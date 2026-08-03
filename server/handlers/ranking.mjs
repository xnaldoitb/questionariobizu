import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
export const handler=async(event)=>{
 if(!(await requireUser(event))) return json(401,{erro:'Não autenticado.'});
 const {data,error}=await db().from('sessoes').select('usuario_id,respondidas,acertos,usuarios(nome,usuario)').not('finalizada_em','is',null).gt('respondidas',0);
 if(error) return json(500,{erro:error.message});
 const map=new Map(); for(const s of data){const x=map.get(s.usuario_id)||{nome:s.usuarios?.nome,usuario:s.usuarios?.usuario,sessoes:0,respondidas:0,acertos:0};x.sessoes++;x.respondidas+=s.respondidas;x.acertos+=s.acertos;map.set(s.usuario_id,x)}
 const ranking=[...map.values()].map(x=>({...x,percentual:Math.round(x.acertos/x.respondidas*100)})).sort((a,b)=>b.acertos-a.acertos||b.percentual-a.percentual||b.respondidas-a.respondidas).slice(0,100);
 return json(200,{ranking});
};
