export async function requestJson(endpoint, options = {}) {
    let response;
    const { timeoutMs = 25000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        response = await fetch(`/api/${endpoint}`, {
            ...fetchOptions,
            credentials: 'include',
            headers: {
                'content-type': 'application/json',
                ...(fetchOptions.headers || {})
            },
            signal: controller.signal,
        });
    } catch (cause) {
        const error = new Error(
            cause?.name === 'AbortError'
                ? 'O servidor demorou para responder. Tentando novamente pode resolver.'
                : 'Não foi possível conectar ao servidor. Tente novamente.'
        );
        error.code = cause?.name === 'AbortError' ? 'API_TIMEOUT' : 'API_NETWORK';
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
        const raw = await response.text().catch(() => '');
        if (!response.ok) {
            if ([502, 503, 504].includes(response.status)) {
                const error = new Error('O servidor demorou para responder. Tente novamente.');
                error.code = 'API_GATEWAY';
                error.status = response.status;
                throw error;
            }
            throw new Error(`Erro de comunicação com a API (${response.status}).`);
        }
        throw new Error(
            raw.startsWith('<!DOCTYPE')
                ? 'A rota da API foi direcionada para a página inicial.'
                : 'A API retornou uma resposta inválida.'
        );
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(payload.erro || `Falha na comunicação (${response.status}).`);
        error.code = payload.codigo || null;
        error.payload = payload;
        error.status = response.status;
        throw error;
    }

    return payload;
}
