import { IMPORT_BODY_LIMIT } from '../../public/app/foundation/import-limits.js';

export function bodyLimitResponse(routeName, method, body, headers = {}) {
    const isImport = routeName === 'admin-import' && method === 'POST';
    const limit = isImport ? IMPORT_BODY_LIMIT : 64 * 1024;
    const actualSize = Buffer.byteLength(body || '', 'utf8');
    const declaredSize = Number(headers['content-length'] || headers['Content-Length'] || 0);
    if (actualSize <= limit && !(declaredSize > limit)) return null;
    return {
        erro: isImport
            ? 'A disciplina ultrapassa 4 MiB de dados. Divida o conteúdo em disciplinas menores antes de importar.'
            : 'Requisição muito grande. O limite desta operação é 64 KiB.',
        codigo: 'REQUISICAO_MUITO_GRANDE',
        limite_bytes: limit,
    };
}
