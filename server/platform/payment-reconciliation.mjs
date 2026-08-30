export function paymentReference(payment) {
    return String(payment?.external_reference || payment?.metadata?.pagamento_id || '');
}

export async function findProviderPayment(record, request) {
    const hintedId = record.mp_payment_id_informado;
    const knownId = hintedId || record.mercado_pago_payment_id;
    let known = null;
    if (knownId) {
        known = await request(`/v1/payments/${encodeURIComponent(knownId)}`);
        if (paymentReference(known) !== record.id || String(known.id) !== String(knownId)) {
            throw new Error('A transação não corresponde à cobrança selecionada.');
        }
        if (hintedId || known.status === 'approved') return known;
    }
    let fallback = known;
    for (let offset = 0; offset < 500; offset += 50) {
        const params = new URLSearchParams({ external_reference: record.id, sort: 'date_created', criteria: 'desc', limit: '50', offset: String(offset) });
        const result = await request(`/v1/payments/search?${params}`);
        if (!Array.isArray(result.results)) throw new Error('Resposta inválida na consulta de pagamentos.');
        const matching = result.results.filter(p => paymentReference(p) === record.id);
        const approved = matching.find(p => p.status === 'approved');
        if (approved) return approved;
        fallback ||= matching[0] || null;
        if (result.results.length < 50 || offset + 50 >= Number(result.paging?.total)) return fallback;
    }
    throw new Error('Há muitas tentativas nesta cobrança. Consulte o administrador.');
}

export async function reconcileRecords(records, reconcile) {
    const results = await Promise.all(records.map(async record => {
        try { return { payment: await reconcile(record) }; }
        catch { return { error: true, id: record.id }; }
    }));
    return {
        confirmados: results.filter(r => r.payment?.status === 'approved' && r.payment?.aplicado_em).length,
        falhas: results.filter(r => r.error).length,
        verificados: records.length,
    };
}
