import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const {
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: key,
    ADMIN_USERNAME = 'admin',
    ADMIN_PASSWORD,
    ADMIN_NOME_GUERRA = 'Administrador',
} = process.env;

if (!url || !key || !ADMIN_PASSWORD) {
    throw new Error('Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ADMIN_PASSWORD.');
}

const db = createClient(url, key, { auth: { persistSession: false } });
const senha_hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
const usuario = ADMIN_USERNAME.trim().toLowerCase();

const { data: existing, error: findError } = await db
    .from('usuarios')
    .select('id,usuario,perfil')
    .or(`usuario.eq.${usuario},perfil.eq.supremo`)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle();

if (findError) throw findError;

const payload = {
    usuario,
    nome: ADMIN_NOME_GUERRA.trim() || 'Administrador',
    senha_hash,
    perfil: 'supremo',
    ativo: true,
    status_aprovacao: 'aprovado',
};

const result = existing
    ? await db.from('usuarios').update(payload).eq('id', existing.id)
    : await db.from('usuarios').insert(payload);

if (result.error) throw result.error;
console.log(`Desenvolvedor ${ADMIN_USERNAME} criado/atualizado.`);
