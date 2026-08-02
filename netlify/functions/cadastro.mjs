import bcrypt from 'bcryptjs';
import { db } from './_lib/db.mjs';
import { createToken, sessionCookie } from './_lib/auth.mjs';
import { json, parseBody } from './_lib/http.mjs';
export const handler=async(event)=>{
 if(event.httpMethod!=='POST') return json(405,{erro:'Método não permitido.'});
 const b=parseBody(event), usuario=String(b.usuario||'').trim().toLowerCase(), nome=String(b.nome||'').trim(), senha=String(b.senha||'');
 if(!/^[a-z0-9._-]{3,30}$/.test(usuario)) return json(400,{erro:'Use de 3 a 30 caracteres no usuário: letras, números, ponto, hífen ou sublinhado.'});
 if(nome.length<3) return json(400,{erro:'Informe seu nome.'});
 if(senha.length<6) return json(400,{erro:'A senha deve ter pelo menos 6 caracteres.'});
 const senha_hash=await bcrypt.hash(senha,12);
 const {data,error}=await db().from('usuarios').insert({usuario,nome,senha_hash,perfil:'aluno',ativo:true}).select('id,usuario,nome,perfil').single();
 if(error) return json(400,{erro:error.code==='23505'?'Esse nome de usuário já existe.':error.message});
 const token=await createToken(data);
 return json(201,{usuario:data},{'set-cookie':sessionCookie(token)});
};
