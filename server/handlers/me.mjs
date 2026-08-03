import { getUser } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
export const handler = async (event) => {
  const user = await getUser(event);
  return user ? json(200, { usuario: user }) : json(401, { erro: 'Não autenticado.' });
};
