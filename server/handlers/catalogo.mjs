import { db } from '../lib/db.mjs';
import { requireUser } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
export const handler = async (event) => {
  if (!(await requireUser(event))) return json(401, { erro: 'Não autenticado.' });
  const { data: disciplinas, error: e1 } = await db().from('disciplinas').select('*').eq('ativo', true).order('ordem');
  const { data: capitulos, error: e2 } = await db().from('capitulos').select('*').eq('ativo', true).order('indice');
  if (e1 || e2) return json(500, { erro: e1?.message || e2?.message });
  return json(200, { disciplinas, capitulos });
};
