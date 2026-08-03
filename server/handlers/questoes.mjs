import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
export const handler = async (event) => {
  if (!(await requireUser(event))) return json(401, { erro: 'Não autenticado.' });
  const p = event.queryStringParameters || {};
  if (!p.disciplina) return json(400, { erro: 'Informe a disciplina.' });
  let query = db().from('questoes').select('id,disciplina_id,capitulo_id,enunciado,alternativas,dificuldade').eq('ativo', true).eq('disciplina_id', p.disciplina);
  if (p.capitulo) query = query.eq('capitulo_id', Number(p.capitulo));
  const { data, error } = await query.limit(Math.min(Number(p.limite) || 500, 500));
  if (error) return json(500, { erro: error.message });
  const embaralhadas = [...data].sort(() => Math.random() - .5);
  return json(200, { questoes: embaralhadas });
};
