import { clearCookie } from './_lib/auth.mjs';
import { json } from './_lib/http.mjs';
export const handler = async () => json(200, { ok: true }, { 'set-cookie': clearCookie });
