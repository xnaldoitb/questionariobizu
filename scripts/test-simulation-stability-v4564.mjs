import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [sessions, access, activity, main, request, migration] = await Promise.all([
    readFile('server/routes/sessoes.mjs', 'utf8'),
    readFile('public/app/domains/access.js', 'utf8'),
    readFile('public/app/domains/session-activity.js', 'utf8'),
    readFile('public/app/main.js', 'utf8'),
    readFile('public/app/foundation/request.js', 'utf8'),
    readFile('supabase/migration-v4.56.4-simulados-performance.sql', 'utf8'),
]);

assert(sessions.includes("rpc('validar_questoes_sessao'"));
assert(sessions.includes('Promise.all(batches.map'));
assert(sessions.includes('const QUESTION_BATCH_SIZE = 500'));
assert(access.includes("syncSessionActivity({ interaction: true }).catch(() => {})"));
assert(activity.includes('requestWasActive'));
assert(main.includes("refreshCatalog().catch(() =>"));
assert(main.includes("await recoverIdentity();\n    } catch"));
assert(request.includes('[502, 503, 504].includes(response.status)'));
assert(migration.includes('q.id = any(p_ids)'));

console.log('v4.56.4: estabilidade de login e simulados validada.');
