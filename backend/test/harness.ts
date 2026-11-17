import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';

/** Boots the API against a disposable loopback test database and returns helpers for signed-in calls. */
export async function startHarness() {
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
  const created: string[] = [];

  async function makeUser(label: string, roles: string[] = []) {
    const email = `${label}-${prefix}@example.com`;
    const user = await db.user.create({ data: { email, name: label, verifiedAt: new Date(),
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    created.push(email);
    for (const roleName of roles) await db.userRole.create({ data: { userId: user.id, roleName } });
    const login = await fetch(base + '/auth/login', { method: 'POST',
      headers: { Origin: appOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200);
    return { id: user.id, email, token: (await login.json()).accessToken as string };
  }
  type Actor = Awaited<ReturnType<typeof makeUser>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Reply = { status: number; body: any };
  async function call(actor: Actor | undefined, method: string, path: string, body?: object): Promise<Reply> {
    const res = await fetch(base + path, { method: method.toUpperCase(), headers: { Origin: appOrigin,
      'Content-Type': 'application/json', ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}) },
    ...(method.toUpperCase() === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) });
    return { status: res.status, body: await res.json().catch(() => null) };
  }
  async function stop(cleanup: () => Promise<void> = async () => {}) {
    server.close();
    try {
      await cleanup();
      await db.user.deleteMany({ where: { email: { in: created } } });
    } finally {
      await db.$disconnect();
    }
  }
  return { db, call, makeUser, stop, prefix, base };
}
