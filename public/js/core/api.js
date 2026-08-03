export async function api(path, options = {}) {
    let response;

    try {
        response = await fetch(`/api/${path}`, {
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
    let data = {};

    if (contentType.includes('application/json')) {
        data = await response.json().catch(() => ({}));
    } else {
        const text = await response.text().catch(() => '');

        if (!response.ok) {
            throw new Error(
                `Erro de comunicação com a API (${response.status}).`
            );
        }

        throw new Error(
            text.startsWith('<!DOCTYPE')
                ? 'A rota da API foi direcionada para a página inicial.'
                : 'A API retornou uma resposta inválida.'
        );
    }

    if (!response.ok) {
        throw new Error(data.erro || `Falha na comunicação (${response.status}).`);
    }

    return data;
}
