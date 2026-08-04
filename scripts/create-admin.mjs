import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
const {SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,ADMIN_USERNAME='admin',ADMIN_PASSWORD}=process.env;
if(!url||!key||!ADMIN_PASSWORD) throw new Error('Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ADMIN_PASSWORD.');
const db=createClient(url,key,{auth:{persistSession:false}});
const senha_hash=await bcrypt.hash(ADMIN_PASSWORD,12);
const {error}=await db.from('usuarios').upsert({usuario:ADMIN_USERNAME.toLowerCase(),nome:'Ronaldo Amorim',senha_hash,perfil:'admin',ativo:true},{onConflict:'usuario'});
if(error) throw error; console.log(`Administrador ${ADMIN_USERNAME} criado/atualizado.`);
