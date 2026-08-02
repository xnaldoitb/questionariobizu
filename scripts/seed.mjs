import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
const db=createClient(url,key,{auth:{persistSession:false}});
const src=JSON.parse(await fs.readFile(new URL('../questions-source.json',import.meta.url),'utf8'));
const subjectNames={ipmb:'IPMB',ti:'Tecnologia da Informação',dppp:'Direito Penal e Processual Penal',dpm:'Direito Penal Militar',dc:'Direito Constitucional'};
for (let si=0;si<src.SUBJECTS.length;si++) {
  const s=src.SUBJECTS[si];
  const {error}=await db.from('disciplinas').upsert({id:s.id,nome:subjectNames[s.id]||s.label,descricao:s.label,ordem:si,ativo:true}); if(error) throw error;
  for(let ci=0;ci<s.chapters.length;ci++){
    const {error}=await db.from('capitulos').upsert({disciplina_id:s.id,indice:ci,nome:s.chapters[ci],ativo:true},{onConflict:'disciplina_id,indice'}); if(error) throw error;
  }
}
const {data:chapters,error:ce}=await db.from('capitulos').select('id,disciplina_id,indice'); if(ce) throw ce;
const map=new Map(chapters.map(c=>[`${c.disciplina_id}:${c.indice}`,c.id]));
await db.from('questoes').delete().gt('id',0);
const rows=src.QUESTIONS.map(q=>({disciplina_id:q.subject,capitulo_id:map.get(`${q.subject}:${q.chapter}`),enunciado:q.q,alternativas:q.options,resposta_correta:q.correct,resolucao:q.res,dificuldade:'media',ativo:true}));
for(let i=0;i<rows.length;i+=100){const {error}=await db.from('questoes').insert(rows.slice(i,i+100));if(error) throw error;console.log(`Importadas ${Math.min(i+100,rows.length)}/${rows.length}`)}
console.log('Banco de questões importado com sucesso.');
