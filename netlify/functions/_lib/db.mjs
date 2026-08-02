import { createClient } from '@supabase/supabase-js';
import { resolve } from 'node:path';
let client;
function carregarEnvLocal(){
 if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)return;
 if(typeof process.loadEnvFile!=='function')return;
 for(const caminho of [resolve(process.cwd(),'.env'),process.env.INIT_CWD?resolve(process.env.INIT_CWD,'.env'):null,process.env.PWD?resolve(process.env.PWD,'.env'):null].filter(Boolean)){
  try{process.loadEnvFile(caminho);if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)return}catch{}
 }
}
export function db(){
 carregarEnvLocal();
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ausentes.');
 if(!client)client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 return client;
}
