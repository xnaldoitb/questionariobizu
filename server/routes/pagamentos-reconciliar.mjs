import { db } from '../platform/db.mjs';
import { consumeRateLimit } from '../platform/rate-limit.mjs';
import { reconcilePayment } from '../platform/payments.mjs';
import { reconcileRecords } from '../platform/payment-reconciliation.mjs';
import { createScheduledPaymentHandler } from '../platform/scheduled-payments.mjs';

export const handler = createScheduledPaymentHandler({
    secret: () => process.env.CRON_SECRET,
    rateLimit: async event => {
        const rate = await consumeRateLimit(event, 'pagamentos-cron', { limit: 1, windowSeconds: 60, includeIp: false, failClosed: true }, 'servidor');
        return rate.allowed;
    },
    claim: async () => {
        const { data, error } = await db().rpc('reservar_pagamentos_reconciliacao');
        if (error) throw error;
        return data || [];
    },
    reconcile: records => reconcileRecords(records, reconcilePayment),
});
