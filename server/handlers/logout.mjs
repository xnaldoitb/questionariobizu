import { clearCookie } from '../lib/auth.mjs';
import { json } from '../lib/http.mjs';
export const handler = async () => json(200, { ok: true }, { 'set-cookie': clearCookie });
