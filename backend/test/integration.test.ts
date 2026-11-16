import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';

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
  CHATBOT_PROVIDER: 'faq', ENABLE_LOGIN_OTP: 'true', ENABLE_GOOGLE_AUTH: 'true',
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test-only',
  ENABLE_TELEGRAM: 'true', TELEGRAM_BOT_TOKEN: 'fake-token',
  TELEGRAM_BOT_USERNAME: 'fake_bot', TELEGRAM_WEBHOOK_SECRET: 'fake_webhook_secret',
});

const { app } = await import('../src/app.js');
const { db } = await import('../src/lib/db.js');
const { emailService } = await import('../src/modules/email/email.service.js');
const { notificationService } = await import('../src/modules/notifications/notification.service.js');
const { frontendDist } = await import('../src/app.js');
const { access } = await import('node:fs/promises');
const { join } = await import('node:path');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert(address && typeof address !== 'string');
const base = 'http://127.0.0.1:' + address.port;
const send = fetch;
const prefix = randomUUID();
const password = 'valid password for tests';
const email = prefix + '@example.com';
const admin = 'admin-' + email;
const updateId = Math.floor(Math.random() * 2_000_000_000);
const users = [email, admin];

after(async () => {
  server.close();
  try {
    await db.user.deleteMany({ where: { email: { in: users } } });
    await db.telegramUpdate.deleteMany({ where: { id: String(updateId) } });
  } finally {
    await db.$disconnect();
  }
});

function post(path: string, body: object, headers: Record<string, string> = {}, method = 'POST') {
  return send(base + '/api/v1' + path, { method,
    headers: { Origin: appOrigin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
const get = (path: string, token?: string) => send(base + path, {
  headers: token ? { Authorization: 'Bearer ' + token } : {},
});
const code = (to: string, subject: string) => {
  const latest = emailService.readMock(to).findLast(message => message.subject === subject);
  const value = latest?.text.match(/\b\d{6}\b/)?.[0];
  assert(value, 'Expected an OTP in the mock inbox');
  return value;
};
const wrong = (value: string) => value === '000000' ? '000001' : '000000';

async function loggedIn(to: string, pass = password) {
  const login = await post('/auth/login', { email: to, password: pass });
  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), { otpRequired: true });
  const res = await post('/auth/login/verify', { email: to, password: pass, code: code(to, 'Your sign-in code') });
  assert.equal(res.status, 200);
  const raw = res.headers.get('set-cookie');
  assert.match(raw ?? '', /HttpOnly.*SameSite=Lax/);
  return { token: (await res.json()).accessToken as string, cookie: raw!.split(';')[0] };
}

test('health, database readiness, API 404, and SPA deep links', async () => {
  assert.deepEqual(await (await get('/health')).json(), { status: 'ok' });
  assert.deepEqual(await (await get('/ready')).json(), { status: 'ready' });
  assert.equal((await get('/api/docs/')).status, 200);
  assert.equal((await (await get('/api/v1/unknown')).json()).error.code, 'NOT_FOUND');
  assert.equal((await (await get('/api/unknown')).json()).error.code, 'NOT_FOUND');
  assert.equal((await get('/api/dev/inbox')).status, 404);
  await access(join(frontendDist, 'index.html'));
  for (const path of ['/', '/login', '/dashboard', '/profile']) {
    const result = await get(path);
    assert.equal(result.status, 200);
    const asset = (await result.text()).match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    assert(asset, 'Expected compiled Vite asset');
    assert.match((await get(asset)).headers.get('content-type') ?? '', /javascript/);
  }
  assert.equal((await get('/assets/missing.js')).status, 404);
});

test('Google sign-in uses the application origin, PKCE, and validates callback state', async () => {
  const path = '/api/v1/auth/google';
  const start = await send(base + path, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const authorize = new URL(start.headers.get('location')!);
  assert.equal(authorize.origin, 'https://accounts.google.com');
  assert.equal(authorize.searchParams.get('redirect_uri'), appOrigin + path + '/callback');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.match(authorize.searchParams.get('state') ?? '', /^[\w-]{43}$/);
  assert.match(authorize.searchParams.get('nonce') ?? '', /^[\w-]{43}$/);
  const cookie = start.headers.get('set-cookie')!.split(';')[0];
  const callback = await send(base + path + '/callback?code=test&state=' + 'x'.repeat(43), {
    redirect: 'manual', headers: { Cookie: cookie },
  });
  assert.equal(callback.headers.get('location'), appOrigin + '/login?google=failed');
  assert.match(callback.headers.get('set-cookie') ?? '', /google_oauth=;/);
});

test('registration, OTP lifecycle, sessions, RBAC, recovery, FAQ, and Telegram', async () => {
  const pendingPassword = 'initial registration password';
  const data = { name: 'Test user', email, password: pendingPassword };
  assert.equal((await post('/auth/register', data, { Origin: 'https://other.example' })).status, 403);
  assert.equal((await post('/auth/register', data)).status, 202);
  assert.equal((await post('/auth/register', { ...data, email: email.toUpperCase() })).status, 202);
  assert.equal(await db.user.count({ where: { email } }), 1);
  assert.equal((await post('/auth/login', { email, password: 'incorrect' })).status, 401);
  assert.equal((await post('/auth/login', { email, password: pendingPassword })).status, 403);

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const initial = code(email, 'Verify your email');
  assert.equal((await post('/auth/verify-email', { email, code: initial })).status, 400);
  assert.equal((await post('/auth/resend-verification', { email })).status, 202);
  assert.equal(emailService.readMock(email).length, 1);
  const challenge = { userId_purpose: { userId: user.id, purpose: 'VERIFY_EMAIL' as const } };
  for (let count = 0; count < 5; count++) {
    assert.equal((await post('/auth/verify-email', { email, code: wrong(initial), password })).status, 400);
  }
  assert.equal((await db.otpChallenge.findUniqueOrThrow({ where: challenge })).attempts, 5);
  assert.equal((await post('/auth/verify-email', { email, code: initial, password })).status, 400);
  await db.otpChallenge.update({ where: challenge, data: {
    attempts: 0, expiresAt: new Date(0), issuedAt: new Date(0),
  } });
  assert.equal((await post('/auth/verify-email', { email, code: initial, password })).status, 400);
  assert.equal((await post('/auth/resend-verification', { email })).status, 202);
  const verification = { email, code: code(email, 'Verify your email'), password };
  const results = await Promise.all([post('/auth/verify-email', verification), post('/auth/verify-email', verification)]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
  assert.equal((await post('/auth/login', { email, password: pendingPassword })).status, 401);

  assert.equal((await get('/api/v1/auth/me')).status, 401);
  let session = await loggedIn(email);
  assert.equal((await get('/api/v1/users/me', session.token)).status, 200);
  assert.equal((await get('/api/v1/users', session.token)).status, 403);

  const verifiedUser = await db.user.findUniqueOrThrow({ where: { email } });
  await db.user.create({ data: { name: 'Admin fixture', email: admin, passwordHash: verifiedUser.passwordHash,
    verifiedAt: new Date(), roles: { create: { roleName: 'ADMIN' } } } });
  const adminSession = await loggedIn(admin);
  assert.equal((await get('/api/v1/users', adminSession.token)).status, 200);

  const rotated = await post('/auth/refresh', {}, { Cookie: session.cookie });
  assert.equal(rotated.status, 200);
  assert.equal((await post('/auth/refresh', {}, { Cookie: session.cookie })).status, 409);
  const newCookie = rotated.headers.get('set-cookie')!.split(';')[0];
  assert.notEqual(newCookie, session.cookie);
  assert.equal((await post('/auth/logout', {}, { Cookie: newCookie })).status, 200);
  assert.equal((await post('/auth/refresh', {}, { Cookie: newCookie })).status, 401);
  assert.equal((await get('/api/v1/auth/me', session.token)).status, 401);
  session = await loggedIn(email);

  const authorization = { Authorization: 'Bearer ' + session.token };
  const chat = await post('/chatbot/message', { message: 'forgot password' }, authorization);
  assert.equal((await chat.json()).provider, 'faq');
  const profile = await post('/users/me', { name: 'Updated', emailOptIn: true }, authorization, 'PATCH');
  assert.equal((await profile.json()).name, 'Updated');
  const notification = { key: prefix + '/email', userId: user.id, type: 'status', channel: 'email' as const,
    data: { subject: 'Status', message: 'Ready' } };
  assert.deepEqual(await notificationService.send(notification), { status: 'MOCKED', duplicate: false });
  assert.deepEqual(await notificationService.send(notification), { status: 'MOCKED', duplicate: true });

  const path = '/integrations/telegram/webhook';
  const link = await post('/integrations/telegram/link', {}, authorization);
  const start = new URL((await link.json()).url).searchParams.get('start');
  const update = { update_id: updateId, message: { chat: { type: 'private', id: updateId }, text: '/start ' + start } };
  assert.equal((await post(path, update)).status, 403);
  let telegramCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.telegram.org/')) return send(url, init);
    telegramCalls += 1;
    return Response.json({ ok: true });
  };
  try {
    const header = { 'X-Telegram-Bot-Api-Secret-Token': 'fake_webhook_secret' };
    assert.equal((await post(path, update, header)).status, 200);
    assert.equal((await post(path, update, header)).status, 200);
    assert.equal(telegramCalls, 1);
    assert.equal((await (await get('/api/v1/users/me', session.token)).json()).telegramConnected, true);
    const telegramNotification = { ...notification, channel: 'telegram' as const, key: prefix + '/telegram' };
    assert.deepEqual(await notificationService.send(telegramNotification), { status: 'ACCEPTED', duplicate: false });
    assert.deepEqual(await notificationService.send(telegramNotification), { status: 'ACCEPTED', duplicate: true });
    assert.equal(telegramCalls, 2);
  } finally {
    globalThis.fetch = send;
  }

  const recovery = await post('/auth/forgot-password', { email });
  const absent = await post('/auth/forgot-password', { email: 'absent-' + email });
  assert.equal(recovery.status, absent.status);
  assert.deepEqual(await recovery.json(), await absent.json());
  const reset = { email, password: 'new longer password!', code: code(email, 'Reset your password') };
  assert.equal((await post('/auth/reset-password', reset)).status, 200);
  assert.equal((await post('/auth/reset-password', reset)).status, 400);
  assert.equal((await get('/api/v1/auth/me', session.token)).status, 401);
  assert.equal((await post('/auth/refresh', {}, { Cookie: session.cookie })).status, 401);
  assert.equal((await post('/auth/login', { email, password })).status, 401);
  assert(await loggedIn(email, reset.password));
});

