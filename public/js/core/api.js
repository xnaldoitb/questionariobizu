export async function api(path, options = {}) {
    const response = await fetch(`/api/${path}`, {
        credentials: 'include',
        headers: {
            'content-type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.erro || 'Falha na comunicação.');
    }

    return data;
}
