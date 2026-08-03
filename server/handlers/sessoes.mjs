import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json, parseBody } from '../lib/http.mjs';
export const handler = async (event) => {
  const user = await requireUser(event);
  if (!user) return json(401, { erro: 'Não autenticado.' });
  if (event.httpMethod === 'GET') {
    const { data, error } = await db().from('sessoes').select('*,disciplinas(nome),capitulos(nome)').eq('usuario_id', user.id).not('finalizada_em','is',null).order('finalizada_em',{ascending:false}).limit(50);
    return error ? json(500,{erro:error.message}) : json(200,{sessoes:data});
  }
  const b = parseBody(event);
  if (event.httpMethod === 'POST') {
    const { data, error } = await db().from('sessoes').insert({ usuario_id:user.id, disciplina_id:b.disciplina_id, capitulo_id:b.capitulo_id || null, total:b.total || 0 }).select().single();
    return error ? json(500,{erro:error.message}) : json(201,{sessao:data});
  }
  if (event.httpMethod === 'PUT') {
    const { data, error } = await db().from('sessoes').update({ respondidas:b.respondidas, acertos:b.acertos, puladas:b.puladas, percentual:b.percentual, finalizada_em:new Date().toISOString() }).eq('id',b.id).eq('usuario_id',user.id).select().single();
    return error ? json(500,{erro:error.message}) : json(200,{sessao:data});
  }
  return json(405,{erro:'Método não permitido.'});
};
