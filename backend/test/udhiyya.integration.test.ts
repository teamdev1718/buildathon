import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import argon2 from 'argon2';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set TEST_DATABASE_URL to a migrated disposable local PostgreSQL database.');
const target = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) {
  throw new Error('Integration tests only accept loopback databases with a name ending in _test.');
}

const appOrigin = 'http://localhost:5173';
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, APP_ORIGIN: appOrigin,
  JWT_SECRET: 'test-jwt-'.repeat(5), OTP_SECRET: 'test-otp-'.repeat(5), EMAIL_PROVIDER: 'mock',
  CHATBOT_PROVIDER: 'faq', ENABLE_LOGIN_OTP: 'false', ENABLE_GOOGLE_AUTH: 'false', ENABLE_TELEGRAM: 'false',
});

const { app } = await import('../src/app.js');
const { db } = await import('../src/lib/db.js');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert(address && typeof address !== 'string');
const base = 'http://127.0.0.1:' + address.port + '/api/v1';
const prefix = randomUUID().slice(0, 8);
const password = 'valid password for tests';
const emails = { admin: `admin-${prefix}@example.com`, collector: `collector-${prefix}@example.com`,
  alice: `alice-${prefix}@example.com`, bob: `bob-${prefix}@example.com` };

async function makeUser(email: string, roles: string[]) {
  const user = await db.user.create({ data: { email, name: email.split('@')[0], verifiedAt: new Date(),
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
  for (const roleName of roles) await db.userRole.create({ data: { userId: user.id, roleName } });
  const login = await fetch(base + '/auth/login', { method: 'POST',
    headers: { Origin: appOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  assert.equal(login.status, 200);
  return { id: user.id, token: (await login.json()).accessToken as string };
}

type Actor = Awaited<ReturnType<typeof makeUser>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reply = { status: number; body: any };
async function call(actor: Actor | undefined, method: string, path: string, body?: object): Promise<Reply> {
  const res = await fetch(base + path, { method: method.toUpperCase(), headers: { Origin: appOrigin, 'Content-Type': 'application/json',
    ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

await db.udhiyyaCycle.deleteMany();
after(async () => {
  server.close();
  try {
    await db.udhiyyaCycle.deleteMany();
    await db.beneficiary.deleteMany();
    await db.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  } finally {
    await db.$disconnect();
  }
});

test('installments, payments, procurement, and meat distribution end to end', async () => {
  const admin = await makeUser(emails.admin, ['ADMIN']);
  const collector = await makeUser(emails.collector, ['COLLECTOR']);
  const alice = await makeUser(emails.alice, ['USER']);
  const bob = await makeUser(emails.bob, ['USER']);

  // Authorization boundaries.
  assert.equal((await call(undefined, 'get', '/udhiyya/cycle')).status, 401);
  const lock = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
  const eid = new Date(Date.now() + 230 * 86_400_000).toISOString().slice(0, 10);
  const cycleBody = { name: 'Test cycle', targetDate: eid, priceLockDate: lock, slots: ['08:00-09:00', '09:00-10:00'] };
  for (const actor of [alice, collector]) assert.equal((await call(actor, 'post', '/udhiyya/cycles', cycleBody)).status, 403);
  assert.equal((await call(alice, 'get', '/udhiyya/cycles/' + randomUUID() + '/summary')).status, 403);
  assert.equal((await call(alice, 'get', '/udhiyya/enrollments')).status, 403);
  assert.equal((await call(alice, 'post', '/udhiyya/tokens/collect', { code: 'ABCDE23456' })).status, 403);

  const created = await call(admin, 'post', '/udhiyya/cycles', cycleBody);
  assert.equal(created.status, 201);
  const cycleId = created.body.id as string;
  assert.equal((await call(admin, 'post', '/udhiyya/cycles', cycleBody)).status, 409);
  assert.equal((await call(admin, 'post', '/udhiyya/cycles', { ...cycleBody, poorPercent: 10 })).status, 400);
  const goat = (await call(admin, 'post', `/udhiyya/cycles/${cycleId}/plans`,
    { name: 'Goat', animalType: 'GOAT', sharePrice: 6000, sharesPerAnimal: 1 })).body;
  const cow = (await call(admin, 'post', `/udhiyya/cycles/${cycleId}/plans`,
    { name: 'Cow share', animalType: 'COW', sharePrice: 14000, sharesPerAnimal: 7 })).body;
  assert.equal((await call(alice, 'get', '/udhiyya/cycle')).body.cycle.plans.length, 2);

  // Enrolment computes the monthly installment and rejects duplicates and mismatched names.
  assert.equal((await call(alice, 'post', '/udhiyya/enrollments', { planId: goat.id, shares: 2, holderNames: ['A'] })).status, 400);
  const aliceGoat = await call(alice, 'post', '/udhiyya/enrollments', { planId: goat.id, shares: 1, holderNames: ['Alice'] });
  assert.equal(aliceGoat.status, 201);
  assert.equal(aliceGoat.body.totalAmount, 6000);
  assert(aliceGoat.body.installments >= 6);
  assert.equal(aliceGoat.body.monthlyAmount, Math.ceil(6000 / aliceGoat.body.installments));
  assert.equal((await call(alice, 'post', '/udhiyya/enrollments', { planId: goat.id, shares: 1, holderNames: ['Alice'] })).status, 409);
  const bobCow = (await call(bob, 'post', '/udhiyya/enrollments', { planId: cow.id, shares: 2, holderNames: ['Bob', 'Bob parent'] })).body;
  assert.equal(bobCow.totalAmount, 28000);

  // Ownership: one member cannot pay into or read another member's enrolment.
  const stranger = await call(bob, 'post', `/udhiyya/enrollments/${aliceGoat.body.id}/online-payments`, { amount: 100, reference: 'X1' });
  assert.equal(stranger.status, 404);
  assert.deepEqual((await call(bob, 'get', '/udhiyya/enrollments/mine')).body.map((e: { id: string }) => e.id), [bobCow.id]);

  // Cash is recorded by a collector; online payments need confirmation and cannot overpay.
  const aliceId = aliceGoat.body.id as string;
  assert.equal((await call(collector, 'post', `/udhiyya/enrollments/${aliceId}/cash-payments`, { amount: 1000 })).status, 201);
  assert.equal((await call(collector, 'post', `/udhiyya/enrollments/${aliceId}/cash-payments`, { amount: 6000 })).status, 409);
  const online = await call(alice, 'post', `/udhiyya/enrollments/${aliceId}/online-payments`, { amount: 5000, reference: 'UPI123' });
  assert.equal(online.status, 201);
  assert.equal((await call(alice, 'post', `/udhiyya/enrollments/${aliceId}/online-payments`, { amount: 1, reference: 'UPI124' })).status, 409);
  let mine = (await call(alice, 'get', '/udhiyya/enrollments/mine')).body[0];
  assert.equal(mine.confirmed, 1000);
  assert.equal(mine.pending, 5000);
  assert.equal((await call(alice, 'post', `/udhiyya/payments/${online.body.id}/confirm`, {})).status, 403);
  assert.equal((await call(collector, 'get', '/udhiyya/payments/pending')).body.length, 1);
  assert.equal((await call(collector, 'post', `/udhiyya/payments/${online.body.id}/confirm`, {})).status, 200);
  assert.equal((await call(collector, 'post', `/udhiyya/payments/${online.body.id}/confirm`, {})).status, 409);
  mine = (await call(alice, 'get', '/udhiyya/enrollments/mine')).body[0];
  assert.equal(mine.standing, 'PAID');
  assert.equal(mine.remaining, 0);
  const found = await call(collector, 'get', '/udhiyya/enrollments?q=' + encodeURIComponent('alice-' + prefix));
  assert.equal(found.body.length, 1);
  await call(collector, 'post', `/udhiyya/enrollments/${bobCow.id}/cash-payments`, { amount: 2000 });

  // Summary and procurement.
  assert.equal((await call(alice, 'get', `/udhiyya/cycles/${cycleId}/summary`)).status, 403);
  const summary = (await call(admin, 'get', `/udhiyya/cycles/${cycleId}/summary`)).body;
  assert.equal(summary.enrollments, 2);
  assert.equal(summary.collected, 8000);
  assert.equal(summary.expected, 34000);
  assert.equal(summary.paidFamilies, 1);
  assert.equal(summary.plans.find((p: { name: string }) => p.name === 'Cow share').animalsNeeded, 1);
  assert.equal((await call(admin, 'patch', `/udhiyya/cycles/${cycleId}`, { status: 'DISTRIBUTION' })).status, 409);
  assert.equal((await call(admin, 'post', `/udhiyya/cycles/${cycleId}/tokens`, {})).status, 409);
  assert.equal((await call(admin, 'patch', `/udhiyya/cycles/${cycleId}`, { status: 'PROCUREMENT' })).status, 200);
  assert.equal((await call(alice, 'post', '/udhiyya/enrollments', { planId: cow.id, shares: 1, holderNames: ['Late'] })).status, 409);
  const animal = { animalType: 'GOAT', label: 'Goat 1', cost: 5500 };
  assert.equal((await call(admin, 'post', `/udhiyya/cycles/${cycleId}/animals`, animal)).status, 201);

  // Distribution: only fully paid members get tokens, beneficiaries share the poor portion.
  assert.equal((await call(collector, 'post', '/udhiyya/beneficiaries', { name: 'Needy', area: 'North' })).status, 403);
  const near = (await call(admin, 'post', '/udhiyya/beneficiaries', { name: 'Needy A', area: 'North' })).body;
  await call(admin, 'post', '/udhiyya/beneficiaries', { name: 'Needy B', area: 'South', needsDelivery: true });
  const generated = await call(admin, 'post', `/udhiyya/cycles/${cycleId}/tokens`, {});
  assert.equal(generated.status, 201);
  assert.equal(generated.body.createdMembers, 1);
  assert.equal(generated.body.createdBeneficiaries, 2);
  assert.equal(generated.body.gramsPerBeneficiary, 1700);
  assert.equal((await call(admin, 'post', `/udhiyya/cycles/${cycleId}/tokens`, {})).body.createdMembers, 0);
  assert.equal((await call(bob, 'get', '/udhiyya/tokens/mine')).body.length, 0);
  const token = (await call(alice, 'get', '/udhiyya/tokens/mine')).body[0];
  assert.equal(token.grams, 6600);
  assert.equal(token.status, 'PENDING');
  assert.equal((await call(collector, 'post', '/udhiyya/tokens/collect', { code: token.code })).status, 409);
  assert.equal((await call(admin, 'patch', `/udhiyya/cycles/${cycleId}`, { status: 'DISTRIBUTION' })).status, 200);
  assert.equal((await call(collector, 'post', '/udhiyya/tokens/collect', { code: 'ZZZZZZZZZZ' })).status, 404);
  assert.equal((await call(collector, 'post', '/udhiyya/tokens/collect', { code: token.code })).status, 200);
  assert.equal((await call(collector, 'post', '/udhiyya/tokens/collect', { code: token.code })).status, 409);
  const progress = (await call(collector, 'get', `/udhiyya/cycles/${cycleId}/distribution`)).body;
  assert.equal(progress.members.collected, 1);
  assert.equal(progress.beneficiaries.pending, 2);
  const list = (await call(admin, 'get', `/udhiyya/cycles/${cycleId}/tokens`)).body;
  assert.equal(list.filter((t: { delivery: boolean }) => t.delivery).length, 1);
  assert.equal((await call(admin, 'delete', '/udhiyya/beneficiaries/' + near.id, {})).status, 200);
  assert.equal((await call(admin, 'delete', '/udhiyya/beneficiaries/' + near.id, {})).status, 404);

  // Collectors are managed by email; reminders honour opt-in without failing.
  assert.equal((await call(admin, 'post', '/udhiyya/collectors', { email: emails.bob, enabled: true })).status, 200);
  assert.equal((await call(admin, 'post', '/udhiyya/collectors', { email: emails.bob, enabled: false })).status, 200);
  assert.equal((await call(admin, 'post', `/udhiyya/cycles/${cycleId}/reminders`, {})).status, 200);
  assert.equal((await call(admin, 'patch', `/udhiyya/cycles/${cycleId}`, { status: 'CLOSED' })).status, 200);
});
