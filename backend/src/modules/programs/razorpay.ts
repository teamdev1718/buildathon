import { createHmac } from 'node:crypto';
import { env, razorpayEnabled } from '../../config/env.js';
import { ApiError, log } from '../../lib/http.js';
import { equal } from '../../lib/secrets.js';

const unavailable = () => new ApiError(503, 'PAYMENTS_UNAVAILABLE', 'Online payments are not enabled yet. Pay your committee in cash for now.');
const sign = (key: string, text: string | Buffer) => createHmac('sha256', key).update(text).digest('hex');

export const razorpay = {
  enabled: () => razorpayEnabled,
  keyId: () => env.RAZORPAY_KEY_ID ?? '',

  /** Creates the order the checkout widget pays against. The amount is in paise. */
  async createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }, request = fetch) {
    if (!razorpayEnabled) throw unavailable();
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
    try {
      const response = await request('https://api.razorpay.com/v1/orders', { method: 'POST', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: input.amountPaise, currency: 'INR', receipt: input.receipt, notes: input.notes }) });
      const body = await response.json().catch(() => null) as { id?: string } | null;
      if (!response.ok || !body?.id) throw new Error('order rejected');
      return { orderId: body.id };
    } catch {
      log('razorpay.order_failed');
      throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'The payment service did not respond. Try again in a moment.');
    }
  },

  /** Checks the signature the checkout widget returns: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
  verifyCheckout(orderId: string, paymentId: string, signature: string) {
    if (!razorpayEnabled) throw unavailable();
    return equal(sign(env.RAZORPAY_KEY_SECRET!, `${orderId}|${paymentId}`), signature);
  },

  /** Checks a webhook delivery against its raw body. Webhooks stay off until a webhook secret is configured. */
  verifyWebhook(rawBody: Buffer, signature: string) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
    return equal(sign(env.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
  },
};
