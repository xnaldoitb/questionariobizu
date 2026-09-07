import { db } from '../platform/db.mjs';
import { requireUser } from '../platform/auth.mjs';
import { json } from '../platform/http.mjs';
export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { erro: 'Método não permitido.' });
  if (!(await requireUser(event))) return json(401, { erro: 'Não autenticado.' });
  const { data: disciplinas, error: e1 } = await db().from('disciplinas')
    .select('id,nome,descricao,ordem').eq('ativo', true).order('ordem');
  const { data: capitulos, error: e2 } = await db().from('capitulos')
    .select('id,disciplina_id,indice,nome').eq('ativo', true).order('indice');
  if (e1 || e2) {
    console.error('Falha ao carregar catálogo:', e1?.message || e2?.message);
    return json(500, { erro: 'Não foi possível carregar o catálogo.' });
  }
  return json(200, { disciplinas, capitulos });
};
