import bcrypt from 'bcryptjs';
import { db } from '../lib/db.mjs';
import { createToken, sessionCookie } from '../lib/auth.mjs';
import { json, parseBody } from '../lib/http.mjs';
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { erro: 'Método não permitido.' });
  try {
    const { usuario = '', senha = '' } = parseBody(event);
    const login = String(usuario).trim().toLowerCase();
    if (!login || !senha) return json(400, { erro: 'Informe usuário e senha.' });
    const { data: user, error } = await db().from('usuarios').select('*').eq('usuario', login).eq('ativo', true).maybeSingle();
    if (error || !user || !(await bcrypt.compare(String(senha), user.senha_hash))) return json(401, { erro: 'Usuário ou senha inválidos.' });
    await db().from('usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('id', user.id);
    const token = await createToken(user);
    return json(200, { usuario: { id: user.id, usuario: user.usuario, nome: user.nome, perfil: user.perfil } }, { 'set-cookie': sessionCookie(token) });
  } catch (e) { return json(500, { erro: e.message }); }
};
