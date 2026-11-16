import assert from 'node:assert/strict';
import { test } from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://localhost/buildathon_test',
  JWT_SECRET: 'test-jwt-'.repeat(5),
  OTP_SECRET: 'test-otp-'.repeat(5),
  EMAIL_PROVIDER: 'mock',
  ENABLE_GOOGLE_AUTH: 'true',
  GOOGLE_CLIENT_ID: '',
  ENABLE_TELEGRAM: 'true',
  TELEGRAM_BOT_TOKEN: '',
  CHATBOT_PROVIDER: 'gemini',
  GEMINI_API_KEY: 'fake-key',
  GEMINI_MODEL: 'fake-model',
});

const { answerFaq, chat, chatInput } = await import('../src/modules/chatbot/chatbot.service.js');
const { emailService } = await import('../src/modules/email/email.service.js');
const { createGmailProvider } = await import('../src/modules/email/gmail.provider.js');
const { googleEnabled, telegramEnabled } = await import('../src/config/env.js');
const { registration } = await import('../src/modules/auth/auth.schema.js');

test('registration validation normalizes email and rejects weak passwords', () => {
  assert.equal(registration.parse({ name: ' Alice ', email: ' ALICE@example.com ', password: 'long password!' }).email,
    'alice@example.com');
  assert.equal(registration.safeParse({ name: 'Alice', email: 'alice@example.com', password: 'short' }).success, false);
});

test('missing optional credentials disable integrations', () => {
  assert.equal(googleEnabled, false);
  assert.equal(telegramEnabled, false);
});

test('FAQ works without a provider and validates message length', () => {
  assert.match(answerFaq('How do I reset my password?'), /Forgot password/);
  assert.match(answerFaq('unrelated'), /Try asking/);
  assert.equal(chatInput.safeParse({ message: 'a'.repeat(501) }).success, false);
});

test('Gemini uses the configured model and falls back on provider failure', async () => {
  const response = await chat('Where is my profile?', async (url, init) => {
    assert.match(String(url), /fake-model:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'fake-key');
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Open Profile.' }] } }] });
  });
  assert.deepEqual(response, { answer: 'Open Profile.', provider: 'gemini' });
  assert.equal((await chat('password', async () => Response.json({}, { status: 503 }))).provider, 'faq');
});

test('mock email records delivery without claiming provider acceptance', async () => {
  const to = 'test@example.com';
  assert.deepEqual(await emailService.send({ to, subject: 'Verify', template: 'verification',
    data: '012345', key: 'unit/mock' }), { status: 'MOCKED' });
  assert.match(emailService.readMock(to)[0].text, /012345/);
});

const gmailCredentials = { clientId: 'test-client', clientSecret: 'test-secret',
  refreshToken: 'test-refresh', from: 'sender@gmail.com' };
const gmailMessage = { to: 'user@example.com', subject: 'Código', text: 'Use code 012345', html: '<p>Use code 012345</p>' };

test('Gmail refreshes once for concurrent sends and sends UTF-8 MIME over HTTPS', async () => {
  let refreshes = 0;
  let sends = 0;
  const gmail = createGmailProvider(gmailCredentials, async (url, init) => {
    assert.equal(init?.method, 'POST');
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      refreshes++;
      assert(init?.body instanceof URLSearchParams);
      assert.deepEqual(Object.fromEntries(init.body), {
        client_id: 'test-client', client_secret: 'test-secret', refresh_token: 'test-refresh',
        grant_type: 'refresh_token',
      });
      return Response.json({ access_token: 'test-access', expires_in: 3600 });
    }
    sends++;
    assert.equal(String(url), 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-access');
    const { raw } = JSON.parse(String(init?.body));
    assert.match(raw, /^[\w-]+$/);
    const mime = Buffer.from(raw, 'base64url').toString('utf8');
    assert.match(mime, /^From: sender@gmail\.com\r\nTo: user@example\.com\r\n/);
    assert(mime.includes('Subject: =?UTF-8?B?Q8OzZGlnbw==?='));
    assert(mime.includes(Buffer.from(gmailMessage.text).toString('base64')));
    assert(mime.includes(Buffer.from(gmailMessage.html).toString('base64')));
    return Response.json({ id: 'sent' });
  });
  await Promise.all([gmail.send(gmailMessage), gmail.send(gmailMessage)]);
  assert.equal(refreshes, 1);
  assert.equal(sends, 2);
});

test('Gmail rejects malformed recipients and does not replay an ambiguous send failure', async () => {
  let calls = 0;
  const gmail = createGmailProvider(gmailCredentials, async url => {
    calls++;
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'test-access', expires_in: 3600 });
    }
    return new Response(null, { status: 503 });
  });
  await assert.rejects(gmail.send({ ...gmailMessage, to: 'user@example.com\r\nBcc: extra@example.com' }));
  assert.equal(calls, 0);
  await assert.rejects(gmail.send(gmailMessage), /Gmail send failed/);
  assert.equal(calls, 2);
});

