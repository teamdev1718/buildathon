import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:5173', DATABASE_URL: 'postgresql://localhost/buildathon_test',
  JWT_SECRET: 'test-jwt-'.repeat(5), OTP_SECRET: 'test-otp-'.repeat(5), EMAIL_PROVIDER: 'mock',
  RAZORPAY_KEY_ID: 'rzp_test_unit', RAZORPAY_KEY_SECRET: 'unit-test-key-secret-123456', RAZORPAY_WEBHOOK_SECRET: 'unit-test-webhook-secret',
});
const logic = await import('../src/modules/programs/payments.logic.js');
const { razorpay } = await import('../src/modules/programs/razorpay.js');

const animals = [{ animalType: 'COW', price: 70000, sharesPerAnimal: 7 }];
const program = { payByDate: new Date('2027-05-01T00:00:00Z'), targetDate: new Date('2027-05-26T00:00:00Z'), animals };

test('installments spread the live price over the months until the pay-by date', () => {
  const booking = { shares: 3, animalType: 'COW', payMode: 'INSTALLMENTS' as const, createdAt: new Date('2026-11-01T00:00:00Z'), program, payments: [] };
  const start = logic.financeOf(booking, new Date('2026-11-01T00:00:00Z'));
  assert.deepEqual([start.total, start.installments, start.monthlyAmount, start.expected, start.standing], [30000, 6, 5000, 5000, 'BEHIND']);
  assert.equal(start.suggested, 5000);
  const paid = { ...booking, payments: [{ amount: 5000, status: 'CONFIRMED' }, { amount: 4000, status: 'PENDING' }] };
  const month2 = logic.financeOf(paid, new Date('2026-12-02T00:00:00Z'));
  assert.deepEqual([month2.paid, month2.pending, month2.expected, month2.standing, month2.due], [5000, 4000, 10000, 'BEHIND', 5000]);
  assert.equal(logic.financeOf(paid, new Date('2026-11-15T00:00:00Z')).standing, 'ON_TRACK');
  const done = logic.financeOf({ ...booking, payments: [{ amount: 30000, status: 'CONFIRMED' }] }, new Date('2027-01-01T00:00:00Z'));
  assert.deepEqual([done.standing, done.remaining, done.suggested, done.nextDue], ['PAID', 0, 0, null]);
});

test('one-time bookings owe everything by the pay-by date and a price change moves the total', () => {
  const booking = { shares: 2, animalType: 'COW', payMode: 'ONE_TIME' as const, createdAt: new Date('2026-11-01T00:00:00Z'), program, payments: [] };
  assert.equal(logic.financeOf(booking, new Date('2027-03-01T00:00:00Z')).standing, 'ON_TRACK');
  assert.equal(logic.financeOf(booking, new Date('2027-05-02T00:00:00Z')).standing, 'BEHIND');
  assert.equal(logic.financeOf(booking, new Date('2027-03-01T00:00:00Z')).suggested, 20000);
  const dearer = { ...booking, program: { ...program, animals: [{ ...animals[0], price: 77000 }] } };
  assert.equal(logic.financeOf(dearer, new Date('2027-03-01T00:00:00Z')).total, 22000);
  const credit = logic.financeOf({ ...booking, payments: [{ amount: 25000, status: 'CONFIRMED' }] });
  assert.deepEqual([credit.credit, credit.remaining, credit.standing], [5000, 0, 'PAID']);
});

test('the pay-by date defaults to a week before Udhiyya', () => {
  assert.equal(logic.defaultPayBy(new Date('2027-05-26T00:00:00Z')).toISOString(), '2027-05-19T00:00:00.000Z');
  assert.equal(logic.toPaise(1500), 150000);
});

test('Razorpay checkout and webhook signatures are verified with the right secrets', () => {
  const good = createHmac('sha256', 'unit-test-key-secret-123456').update('order_1|pay_1').digest('hex');
  assert.equal(razorpay.verifyCheckout('order_1', 'pay_1', good), true);
  assert.equal(razorpay.verifyCheckout('order_1', 'pay_2', good), false);
  assert.equal(razorpay.verifyCheckout('order_1', 'pay_1', 'x'.repeat(64)), false);
  const body = Buffer.from('{"event":"payment.captured"}');
  const hook = createHmac('sha256', 'unit-test-webhook-secret').update(body).digest('hex');
  assert.equal(razorpay.verifyWebhook(body, hook), true);
  assert.equal(razorpay.verifyWebhook(Buffer.from('{"event":"tampered"}'), hook), false);
});

test('creating an order sends the amount in paise with basic auth and surfaces provider failures safely', async () => {
  let seen: { url: string; auth: string | null; body: { amount: number; currency: string } } | undefined;
  const ok = await razorpay.createOrder({ amountPaise: 250000, receipt: 'r1', notes: {} }, async (url, init) => {
    seen = { url: String(url), auth: new Headers(init?.headers).get('Authorization'), body: JSON.parse(String(init?.body)) };
    return Response.json({ id: 'order_ABC' });
  });
  assert.equal(ok.orderId, 'order_ABC');
  assert.equal(seen?.url, 'https://api.razorpay.com/v1/orders');
  assert.equal(seen?.auth, 'Basic ' + Buffer.from('rzp_test_unit:unit-test-key-secret-123456').toString('base64'));
  assert.deepEqual([seen?.body.amount, seen?.body.currency], [250000, 'INR']);
  await assert.rejects(razorpay.createOrder({ amountPaise: 100, receipt: 'r', notes: {} }, async () => Response.json({}, { status: 400 })),
    (error: { code?: string }) => error.code === 'PAYMENT_PROVIDER_ERROR');
});
