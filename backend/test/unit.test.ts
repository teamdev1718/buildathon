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

