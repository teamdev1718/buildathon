import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, test } from 'node:test';

Object.assign(process.env, { RAZORPAY_KEY_ID: 'rzp_test_int', RAZORPAY_KEY_SECRET: 'int-test-key-secret-1234567', RAZORPAY_WEBHOOK_SECRET: 'int-test-webhook-secret' });
const { startHarness } = await import('./harness.js');
const { db, call, makeUser, stop, prefix, base } = await startHarness();
const code = 'Y' + prefix.toUpperCase();
after(() => stop(() => db.mahallu.deleteMany({ where: { code } }).then(() => {})));

const realFetch = globalThis.fetch;
let orders = 0;
function fakeRazorpay(fail = false) {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input).startsWith('https://api.razorpay.com/v1/orders')) {
      return fail ? Response.json({ error: 'nope' }, { status: 500 }) : Response.json({ id: 'order_test_' + ++orders });
    }
    return realFetch(input, init);
  }) as typeof fetch;
}
const hmac = (key: string, text: string | Buffer) => createHmac('sha256', key).update(text).digest('hex');

test('payments: cash and Razorpay, schedule, signatures, webhook, history and access', async () => {
  const superAdmin = await makeUser('super', ['ADMIN']);
  const admin = await makeUser('padmin');
  const alice = await makeUser('alice');
  const bob = await makeUser('bob');
  const mahallu = (await call(superAdmin, 'post', '/mahallus', { name: 'Pay', district: 'D', code })).body;
  await call(superAdmin, 'post', `/mahallus/${mahallu.id}/admins`, { email: admin.email, enabled: true });
  await call(admin, 'post', `/mahallus/${mahallu.id}/households/import`, { rows: [
    { mahalluNumber: '1', ownerName: 'Alice', memberCount: 3, address: 'a', phone: '9100000001' },
    { mahalluNumber: '2', ownerName: 'Bob', memberCount: 3, address: 'b', phone: '9100000002' }] });
  await call(alice, 'post', '/me/households/link', { mahalluId: mahallu.id, mahalluNumber: '1', phone: '9100000001' });
  await call(bob, 'post', '/me/households/link', { mahalluId: mahallu.id, mahalluNumber: '2', phone: '9100000002' });
  const program = (await call(admin, 'post', `/mahallus/${mahallu.id}/programs`,
    { name: 'Udhiyya 2027', year: 2027, targetDate: '2027-05-26', payByDate: '2027-05-01' })).body;
  assert.equal(program.payBy.slice(0, 10), '2027-05-01');
  assert.equal((await call(admin, 'post', `/mahallus/${mahallu.id}/programs`, { name: 'x', year: 2027, targetDate: '2027-05-26', payByDate: '2027-06-01' })).status, 400);
  await call(admin, 'patch', `/programs/${program.id}/animals/COW`, { price: 70000 });
  await call(admin, 'patch', `/programs/${program.id}/animals/GOAT`, { price: 9000 });
  await call(admin, 'patch', `/programs/${program.id}/animals/SHEEP`, { enabled: false });
  await call(admin, 'patch', `/programs/${program.id}/animals/CAMEL`, { enabled: false });
  assert.equal((await call(admin, 'post', `/programs/${program.id}/start`, {})).status, 200);
  const mine = async (actor: typeof alice) => (await call(actor, 'get', '/me/programs')).body[0].bookings;
  const aliceBooking = (await call(alice, 'post', `/programs/${program.id}/bookings`, { householdId: (await call(alice, 'get', '/me/programs')).body[0].household.id, animalType: 'COW', shares: 3, payMode: 'INSTALLMENTS' })).body;
  const aliceId = aliceBooking.id as string;
  let booking = (await mine(alice))[0];
  assert.equal(booking.money.total, 30000);
  assert.equal(booking.money.paid, 0);
  assert(booking.money.installments >= 1 && booking.money.monthlyAmount * booking.money.installments >= 30000);

  // Online payment needs a valid amount and the member's own booking; the signature decides.
  fakeRazorpay();
  try {
    assert.equal((await call(alice, 'get', '/payments/config')).body.online, true);
    assert.equal((await call(bob, 'post', `/bookings/${aliceId}/payments/online`, { amount: 1000 })).status, 404);
    assert.equal((await call(alice, 'post', `/bookings/${aliceId}/payments/online`, { amount: 30001 })).status, 409);
    assert.equal((await call(alice, 'post', `/bookings/${aliceId}/payments/online`, { amount: 0 })).status, 400);
    const started = await call(alice, 'post', `/bookings/${aliceId}/payments/online`, { amount: 10000 });
    assert.equal(started.status, 201);
    assert.deepEqual([started.body.amountPaise, started.body.currency, started.body.keyId], [1_000_000, 'INR', 'rzp_test_int']);
    assert.equal((await mine(alice))[0].money.paid, 0);
    const pay = 'pay_abc12345';
    const orderId = started.body.orderId as string;
    assert.equal((await call(alice, 'post', `/payments/${started.body.paymentId}/verify`, { razorpayPaymentId: pay, signature: 'f'.repeat(64) })).status, 400);
    assert.equal((await call(bob, 'post', `/payments/${started.body.paymentId}/verify`, { razorpayPaymentId: pay, signature: hmac('int-test-key-secret-1234567', `${orderId}|${pay}`) })).status, 404);
    const verified = await call(alice, 'post', `/payments/${started.body.paymentId}/verify`, { razorpayPaymentId: pay, signature: hmac('int-test-key-secret-1234567', `${orderId}|${pay}`) });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.status, 'CONFIRMED');
    assert.equal((await call(alice, 'post', `/payments/${started.body.paymentId}/verify`, { razorpayPaymentId: pay, signature: hmac('int-test-key-secret-1234567', `${orderId}|${pay}`) })).status, 200);
    booking = (await mine(alice))[0];
    assert.equal(booking.money.paid, 10000);

    // Webhook confirms a payment the browser never reported, once, and rejects bad signatures and wrong amounts.
    const second = (await call(alice, 'post', `/bookings/${aliceId}/payments/online`, { amount: 5000 })).body;
    const event = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_hook0001', order_id: second.orderId, amount: 500_000, status: 'captured' } } } };
    const raw = JSON.stringify(event);
    const send = (body: string, signature: string) => realFetch(base + '/integrations/razorpay/webhook', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': signature }, body });
    assert.equal((await send(raw, 'bad')).status, 401);
    assert.equal((await send(raw.replace('captured', 'captured '), hmac('int-test-webhook-secret', raw))).status, 401);
    const wrongAmount = JSON.stringify({ ...event, payload: { payment: { entity: { ...event.payload.payment.entity, amount: 100 } } } });
    assert.equal((await send(wrongAmount, hmac('int-test-webhook-secret', wrongAmount))).status, 200);
    assert.equal((await mine(alice))[0].money.paid, 10000);
    assert.equal((await send(raw, hmac('int-test-webhook-secret', raw))).status, 200);
    assert.equal((await send(raw, hmac('int-test-webhook-secret', raw))).status, 200);
    assert.equal((await mine(alice))[0].money.paid, 15000);
  } finally {
    globalThis.fetch = realFetch;
  }

  // A booking with money on record cannot be cancelled, by the member or the admin.
  assert.equal((await call(alice, 'delete', `/bookings/${aliceId}`)).status, 409);
  assert.equal((await call(admin, 'delete', `/bookings/${aliceId}`)).status, 409);

  // Cash: only the mahallu admin records it, within the balance, and mistakes can be voided.
  assert.equal((await call(alice, 'post', `/bookings/${aliceId}/payments/cash`, { amount: 100 })).status, 403);
  assert.equal((await call(admin, 'post', `/bookings/${aliceId}/payments/cash`, { amount: 15001 })).status, 409);
  const cash = await call(admin, 'post', `/bookings/${aliceId}/payments/cash`, { amount: 5000, note: 'Handed to committee' });
  assert.equal(cash.status, 201);
  assert.equal((await mine(alice))[0].money.paid, 20000);
  assert.equal((await call(bob, 'post', `/payments/${cash.body.id}/void`, { note: 'oops' })).status, 403);
  assert.equal((await call(admin, 'post', `/payments/${cash.body.id}/void`, { note: 'Entered twice' })).status, 200);
  assert.equal((await call(admin, 'post', `/payments/${cash.body.id}/void`, { note: 'Entered twice' })).status, 409);
  assert.equal((await mine(alice))[0].money.paid, 15000);
  await call(admin, 'post', `/bookings/${aliceId}/payments/cash`, { amount: 15000 });
  booking = (await mine(alice))[0];
  assert.deepEqual([booking.money.standing, booking.money.remaining], ['PAID', 0]);
  assert.equal((await call(alice, 'post', `/bookings/${aliceId}/payments/online`, { amount: 1 })).status, 409);

  // History, autopay and the admin overview.
  const history = (await call(alice, 'get', '/me/payments')).body;
  assert.deepEqual(history.map((row: { status: string }) => row.status).sort(), ['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'REJECTED']);
  assert.equal((await call(bob, 'get', '/me/payments')).body.length, 0);
  assert.equal((await call(bob, 'put', `/bookings/${aliceId}/autopay`, { enabled: true })).status, 404);
  assert.equal((await call(alice, 'put', `/bookings/${aliceId}/autopay`, { enabled: true })).status, 200);
  assert.equal((await mine(alice))[0].autopay, true);
  assert.equal((await call(alice, 'get', `/programs/${program.id}/payments`)).status, 403);
  const overview = (await call(admin, 'get', `/programs/${program.id}/payments`)).body;
  assert.deepEqual([overview.expected, overview.collected, overview.outstanding, overview.cash, overview.online], [30000, 30000, 0, 15000, 15000]);
  assert.equal((await call(alice, 'post', `/programs/${program.id}/reminders`, {})).status, 403);
  assert.equal((await call(admin, 'post', `/programs/${program.id}/reminders`, {})).status, 200);

  // A provider failure is reported cleanly and leaves no pending payment behind.
  const bobBooking = (await call(admin, 'post', `/programs/${program.id}/bookings`, { householdId: (await call(bob, 'get', '/me/programs')).body[0].household.id, animalType: 'GOAT', shares: 1 })).body;
  fakeRazorpay(true);
  try {
    assert.equal((await call(bob, 'post', `/bookings/${bobBooking.id}/payments/online`, { amount: 500 })).status, 502);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal((await call(bob, 'get', '/me/payments')).body[0].status, 'REJECTED');

  // Payments close when the program ends.
  await call(admin, 'post', `/programs/${program.id}/end`, {});
  assert.equal((await call(admin, 'post', `/bookings/${bobBooking.id}/payments/cash`, { amount: 500 })).status, 409);
});
