import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { db } from './db.mjs';
import { findProviderPayment, paymentReference, reconcileRecords } from './payment-reconciliation.mjs';

export function mercadoPagoToken() {
    const token = String(process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim();
    if (!token) throw new Error('Pagamento temporariamente indisponível.');
    return token;
}

export function applicationUrl(event) {
    const configured = String(process.env.APP_URL || '').trim().replace(/\/$/, '');
    if (configured) return configured;
    if (process.env.VERCEL_ENV === 'production') {
        throw new Error('APP_URL não configurada para o ambiente de produção.');
    }
    const host = event.headers['x-forwarded-host'] || event.headers.host;
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    if (!host) throw new Error('APP_URL não configurada.');
    return `${protocol}://${host}`;
}

export async function mercadoPagoRequest(path, options = {}) {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
        ...options,
        signal: options.signal || AbortSignal.timeout(10000),
        headers: {
            authorization: `Bearer ${mercadoPagoToken()}`,
            'content-type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('Mercado Pago:', response.status, payload?.message || payload?.error);
        throw new Error('Não foi possível iniciar ou confirmar o pagamento no Mercado Pago.');
    }
    return payload;
}

export function newPaymentId() {
    return randomUUID();
}

export async function loadPlans({ activeOnly = true } = {}) {
    let query = db()
        .from('planos_acesso')
        .select('id,nome,preco,duracao_dias,acesso_permanente,ativo,ordem,criado_em,atualizado_em')
        .order('ordem', { ascending: true })
        .order('preco', { ascending: true });
    if (activeOnly) query = query.eq('ativo', true);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function loadPlan(planId) {
    const { data, error } = await db()
        .from('planos_acesso')
        .select('id,nome,preco,duracao_dias,acesso_permanente,ativo,ordem')
        .eq('id', planId)
        .eq('ativo', true)
        .maybeSingle();
    if (error) throw error;
    return data || null;
}

function pixPayerEmail(event, user) {
    const configured = String(process.env.MERCADO_PAGO_PAYER_EMAIL || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)) return configured;

    const host = new URL(applicationUrl(event)).hostname.toLowerCase();
    const domain = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? host : 'example.com';
    const account = String(user?.usuario || user?.id || 'usuario')
        .normalize('NFKD')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()
        .slice(0, 36) || 'usuario';
    return `pix.${account}@${domain}`;
}

function mercadoPagoTicketUrl(value) {
    try {
        const url = new URL(String(value || ''));
        const trusted = url.protocol === 'https:' && (
            url.hostname === 'mercadopago.com.br'
            || url.hostname.endsWith('.mercadopago.com.br')
            || url.hostname === 'mercadopago.com'
            || url.hostname.endsWith('.mercadopago.com')
        );
        return trusted ? url.toString() : null;
    } catch {
        return null;
    }
}

export async function createCheckoutPreference({ event, user, plan }) {
    const paymentId = newPaymentId();
    const value = Number(plan.preco);
    const { error: insertError } = await db().from('pagamentos').insert({
        id: paymentId,
        usuario_id: user.id,
        plano: plan.id,
        plano_nome: plan.nome,
        valor: value,
        duracao_dias: plan.duracao_dias,
        acesso_permanente: Boolean(plan.acesso_permanente),
        status: 'pendente',
        origem: 'mercado_pago',
    });
    if (insertError) throw insertError;

    try {
        const baseUrl = applicationUrl(event);
        const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const names = String(user.nome || 'Aluno Bizu').trim().split(/\s+/);
        const payment = await mercadoPagoRequest('/v1/payments', {
            method: 'POST',
            headers: { 'x-idempotency-key': paymentId },
            body: JSON.stringify({
                transaction_amount: value,
                description: `Questionário Bizu — ${plan.nome}`,
                payment_method_id: 'pix',
                external_reference: paymentId,
                notification_url: `${baseUrl}/api/pagamento-webhook`,
                date_of_expiration: expiration,
                payer: {
                    email: pixPayerEmail(event, user),
                    first_name: names[0].slice(0, 60),
                    last_name: names.slice(1).join(' ').slice(0, 60) || names[0].slice(0, 60),
                },
                metadata: { pagamento_id: paymentId, usuario_id: user.id, plano: plan.id },
            }),
        });

        const transaction = payment?.point_of_interaction?.transaction_data || {};
        const qrCode = String(transaction.qr_code || '').trim().slice(0, 4096);
        const qrBase64 = String(transaction.qr_code_base64 || '').replace(/\s/g, '');
        if (!qrCode || !qrBase64 || !/^[a-z0-9+/]+=*$/i.test(qrBase64)) {
            throw new Error('O Mercado Pago não retornou o QR Code Pix. Tente novamente.');
        }

        const { error: updateError } = await db().from('pagamentos').update({
            mercado_pago_payment_id: String(payment.id),
            status: String(payment.status || 'pending'),
            atualizado_em: new Date().toISOString(),
        }).eq('id', paymentId);
        if (updateError) throw updateError;
        return {
            pagamento_id: paymentId,
            mercado_pago_payment_id: String(payment.id),
            plano: plan.id,
            plano_nome: plan.nome,
            valor: value,
            status: String(payment.status || 'pending'),
            qr_code: qrCode,
            qr_code_base64: qrBase64,
            checkout_url: mercadoPagoTicketUrl(transaction.ticket_url),
            expira_em: payment.date_of_expiration || expiration,
        };
    } catch (error) {
        await db().from('pagamentos').update({ status: 'erro', atualizado_em: new Date().toISOString() }).eq('id', paymentId);
        throw error;
    }
}

function headerValue(event, name) {
    return event.headers[name] || event.headers[name.toLowerCase()] || event.headers[name.toUpperCase()] || '';
}

export function validateWebhookSignature(event, dataId) {
    const secret = String(process.env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim();
    const signature = headerValue(event, 'x-signature');
    const requestId = headerValue(event, 'x-request-id');
    if (!secret || !signature || !requestId || !dataId) return false;

    const parts = Object.fromEntries(signature.split(',').map((part) => part.trim().split('=', 2)));
    if (!parts.ts || !parts.v1) return false;

    const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    const received = String(parts.v1);
    if (expected.length !== received.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function latestPaymentForUser(userId) {
    const { data, error } = await db()
        .from('pagamentos')
        .select('id,plano,valor,status,mercado_pago_preference_id,mercado_pago_payment_id,criado_em,aprovado_em,aplicado_em,compensacao_manual_id')
        .eq('usuario_id', userId)
        .eq('origem', 'mercado_pago')
        .is('excluido_em', null)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data || null;
}

export async function applyMercadoPagoPayment(payment) {
    const internalId = paymentReference(payment);
    if (!/^[0-9a-f-]{36}$/i.test(internalId)) {
        return { aplicado: false, motivo: 'referencia_invalida' };
    }

    const { data, error } = await db().rpc('confirmar_pagamento_pix', {
        p_pagamento_id: internalId,
        p_mercado_pago_payment_id: String(payment.id),
        p_status: String(payment.status || 'desconhecido'),
        p_valor_recebido: Number(payment.transaction_amount || 0),
        p_moeda: String(payment.currency_id || ''),
        p_meio_pagamento: String(payment.payment_method_id || ''),
    });
    if (error) throw error;
    return data;
}

export async function reconcilePayment(paymentRecord) {
    if (!paymentRecord || paymentRecord.aplicado_em) return paymentRecord;

    const { error: touchError } = await db().from('pagamentos')
        .update({ ultima_consulta_em: new Date().toISOString() }).eq('id', paymentRecord.id);
    if (touchError) throw touchError;
    const signal = AbortSignal.timeout(15000);
    const mercadoPagoPayment = await findProviderPayment(paymentRecord, path => mercadoPagoRequest(path, { signal }));
    if (!mercadoPagoPayment) return paymentRecord;
    await applyMercadoPagoPayment(mercadoPagoPayment);
    const { data, error } = await db().from('pagamentos').select('*').eq('id', paymentRecord.id).single();
    if (error) throw error;
    return data;
}

export const REMOVABLE_PAYMENT_STATUSES = new Set([
    'pendente', 'pending', 'in_process', 'cancelled', 'canceled', 'rejected', 'erro', 'failure',
]);

export function paymentCanBeRemoved(payment) {
    return Boolean(
        payment
        && payment.origem === 'mercado_pago'
        && !payment.aplicado_em
        && REMOVABLE_PAYMENT_STATUSES.has(String(payment.status || '').toLowerCase())
    );
}

export async function expireCheckoutPreference(payment) {
    if (payment?.mercado_pago_payment_id) {
        if (['pendente', 'pending', 'in_process', 'authorized'].includes(String(payment.status || '').toLowerCase())) {
            await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(payment.mercado_pago_payment_id)}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
        }
        return;
    }
    if (!payment?.mercado_pago_preference_id) return;
    const now = Date.now();
    const createdAt = new Date(payment.criado_em || now).getTime();
    await mercadoPagoRequest(`/checkout/preferences/${encodeURIComponent(payment.mercado_pago_preference_id)}`, {
        method: 'PUT',
        body: JSON.stringify({
            expires: true,
            expiration_date_from: new Date(Math.min(createdAt, now - 1000)).toISOString(),
            expiration_date_to: new Date(now + 60000).toISOString(),
        }),
    });
}

export async function reconcilePaymentsForUser(userId) {
    const { data, error } = await db().from('pagamentos').select('*')
        .eq('usuario_id', userId).eq('origem', 'mercado_pago').is('aplicado_em', null)
        .is('excluido_em', null)
        .or(`ultima_consulta_em.is.null,ultima_consulta_em.lt.${new Date(Date.now() - 25000).toISOString()}`)
        .order('ultima_consulta_em', { ascending: true, nullsFirst: true })
        .order('criado_em', { ascending: true }).limit(5);
    if (error) throw error;
    return reconcileRecords(data || [], reconcilePayment);
}
