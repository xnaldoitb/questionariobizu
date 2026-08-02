import { SignJWT, jwtVerify } from 'jose';
import { resolve } from 'node:path';
const encoder=new TextEncoder();
function carregarEnvLocal(){
 if(process.env.JWT_SECRET)return;
 if(typeof process.loadEnvFile!=='function')return;
 for(const caminho of [resolve(process.cwd(),'.env'),process.env.INIT_CWD?resolve(process.env.INIT_CWD,'.env'):null,process.env.PWD?resolve(process.env.PWD,'.env'):null].filter(Boolean)){
  try{process.loadEnvFile(caminho);if(process.env.JWT_SECRET)return}catch{}
 }
}
const secret=()=>{carregarEnvLocal();const value=process.env.JWT_SECRET;if(!value||value.length<32)throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');return encoder.encode(value)};
export async function createToken(user){return new SignJWT({nome:user.nome,perfil:user.perfil,usuario:user.usuario}).setProtectedHeader({alg:'HS256'}).setSubject(user.id).setIssuedAt().setExpirationTime('12h').sign(secret())}
export async function getUser(event){const cookie=event.headers.cookie||event.headers.Cookie||'';const token=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('quiz_session='))?.slice(13);if(!token)return null;try{const{payload}=await jwtVerify(token,secret());return{id:payload.sub,...payload}}catch{return null}}
export async function requireUser(event,role){const user=await getUser(event);if(!user||(role&&user.perfil!==role))return null;return user}
export const sessionCookie=token=>`quiz_session=${token}; Path=/; HttpOnly; ${process.env.CONTEXT==='dev'?'':'Secure; '}SameSite=Lax; Max-Age=43200`;
export const clearCookie=`quiz_session=; Path=/; HttpOnly; ${process.env.CONTEXT==='dev'?'':'Secure; '}SameSite=Lax; Max-Age=0`;
