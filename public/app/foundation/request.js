export async function requestJson(endpoint, options = {}) {
    let response;

    try {
        response = await fetch(`/api/${endpoint}`, {
            credentials: 'include',
            headers: {
                'content-type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        });
    } catch {
        throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
        const raw = await response.text().catch(() => '');
        if (!response.ok) {
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
