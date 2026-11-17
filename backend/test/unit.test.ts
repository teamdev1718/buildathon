import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { z } from 'zod';

Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://localhost/buildathon_test',
  JWT_SECRET: 'test-jwt-'.repeat(5),
  OTP_SECRET: 'test-otp-'.repeat(5),
  EMAIL_PROVIDER: 'mock',
  ENABLE_GOOGLE_AUTH: 'true',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GMAIL_CLIENT_ID: '',
  GMAIL_CLIENT_SECRET: '',
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
const { ai, AiOutputError } = await import('../src/modules/ai/ai.service.js');

test('registration validation normalizes email and rejects weak passwords', () => {
  assert.equal(registration.parse({ name: ' Alice ', email: ' ALICE@example.com ', password: 'long password!' }).email,
    'alice@example.com');
  assert.equal(registration.safeParse({ name: 'Alice', email: 'alice@example.com', password: 'short' }).success, false);
});

test('missing optional credentials disable integrations', () => {
  assert.equal(googleEnabled, false);
  assert.equal(telegramEnabled, false);
});

function readConfig(expression: string, overrides: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [
    '--import', 'tsx', '--input-type=module', '-e',
    "import { env, googleEnabled } from './src/config/env.ts'; console.log(" + expression + ')',
  ], { encoding: 'utf8', env: { ...process.env, ...overrides } });
}

test('production configuration accepts a trailing slash and identifies invalid settings', () => {
  const origin = 'https://example.onrender.com';
  const read = (overrides: NodeJS.ProcessEnv) => readConfig('env.APP_ORIGIN', {
    NODE_ENV: 'production', APP_ORIGIN: origin + '/', EMAIL_PROVIDER: 'gmail', ...overrides,
  });

  const valid = read({});
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.stdout.trim(), origin);
  for (const [overrides, message] of [
    [{ APP_ORIGIN: origin + '/login' }, /APP_ORIGIN must be the app URL/],
    [{ APP_ORIGIN: 'http://example.onrender.com' }, /APP_ORIGIN must be the public HTTPS app URL/],
    [{ OTP_SECRET: process.env.JWT_SECRET }, /JWT_SECRET and OTP_SECRET must be different/],
    [{ EMAIL_PROVIDER: 'mock' }, /EMAIL_PROVIDER must be gmail or disabled/],
  ] as const) {
    const invalid = read(overrides);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, message);
  }
});

test('Google sign-in reuses the Gmail OAuth pair unless a dedicated client is configured', () => {
  const read = (overrides: NodeJS.ProcessEnv) => readConfig(
    'JSON.stringify([googleEnabled, env.GOOGLE_CLIENT_ID, env.GOOGLE_CALLBACK_URL])', {
      ENABLE_GOOGLE_AUTH: '',
      GMAIL_CLIENT_ID: 'gmail-client', GMAIL_CLIENT_SECRET: 'gmail-secret', ...overrides,
    },
  );
  const shared = read({});
  assert.equal(shared.status, 0, shared.stderr);
  assert.deepEqual(JSON.parse(shared.stdout), [
    true, 'gmail-client', 'http://localhost:5173/api/v1/auth/google/callback',
  ]);
  assert.deepEqual(JSON.parse(read({ GOOGLE_CLIENT_ID: 'login-client', ENABLE_GOOGLE_AUTH: 'true' }).stdout)
    .slice(0, 2), [false, 'login-client']);
  assert.deepEqual(JSON.parse(read({ GOOGLE_CLIENT_ID: 'login-client', GOOGLE_CLIENT_SECRET: 'login-secret',
    ENABLE_GOOGLE_AUTH: 'true' }).stdout).slice(0, 2), [true, 'login-client']);
  assert.equal(JSON.parse(read({ ENABLE_GOOGLE_AUTH: 'false' }).stdout)[0], false);
  assert.equal(JSON.parse(read({ GOOGLE_CALLBACK_URL: 'https://old.example/callback' }).stdout)[0], true);
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

function geminiReply(text: string) {
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
}

test('AI extraction requests structured JSON and validates required and optional fields', async () => {
  const schema = z.strictObject({
    quantity: z.number().int().positive(), location: z.string(), deadline: z.string().optional(),
  });
  const input = { input: '45 packets near the bus stand.', schema };
  const result = await ai.extract(input, async (_url, request) => {
    const body = JSON.parse(String(request?.body));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.responseJsonSchema.properties.quantity.type, 'integer');
    assert.equal(body.generationConfig.responseJsonSchema.required, undefined);
    assert.match(body.systemInstruction.parts[0].text, /Never guess/);
    return geminiReply('{"quantity":45,"location":"near the bus stand"}');
  });
  assert.deepEqual(result, { quantity: 45, location: 'near the bus stand' });
  for (const reply of ['{"location":"bus stand"}', '{"quantity":"45","location":"bus stand"}']) {
    await assert.rejects(ai.extract(input, async () => geminiReply(reply)),
      error => error instanceof AiOutputError && error.fields.includes('quantity'));
  }
  await assert.rejects(ai.extract({ input: 'No quantity supplied.', schema: z.object({ quantity: z.number().default(45) }) },
    async () => assert.fail('should reject defaulted extraction schemas before calling Gemini')),
  { code: 'AI_INVALID_SCHEMA' });
});

test('AI classification accepts supplied categories and always requires human review', async () => {
  const input = { text: 'Unclear request.', categories: ['EMERGENCY', 'UNKNOWN'] };
  assert.deepEqual(await ai.classify(input, async () =>
    geminiReply('{"category":"UNKNOWN","priority":"LOW","reason":"Unclear request."}')),
  { category: 'UNKNOWN', priority: 'LOW', reason: 'Unclear request.', requiresHumanReview: true });
  await assert.rejects(ai.classify(input, async () =>
    geminiReply('{"category":"MEDICAL","priority":"HIGH","reason":"Invalid category."}')),
  { code: 'AI_SCHEMA_MISMATCH' });
  await assert.rejects(ai.classify(input, async () =>
    geminiReply('{"category":"UNKNOWN","priority":"URGENT","reason":"Invalid priority."}')),
  { code: 'AI_SCHEMA_MISMATCH' });
});

test('AI recommendation validates candidate IDs, rank uniqueness, and result limits', async () => {
  const input = { candidates: [{ id: 'a', distance: 2 }, { id: 'b', distance: 8 }],
    criteria: 'Prefer candidates closer to pickup.', maxResults: 1 };
  const item = { candidateId: 'a', reason: 'Closer to pickup.' };
  assert.deepEqual(await ai.recommend(input, async () => geminiReply(JSON.stringify({ recommendations: [item] }))),
    { recommendations: [item] });
  const mock = (...entries: typeof item[]) => async () => geminiReply(JSON.stringify({ recommendations: entries }));
  await assert.rejects(ai.recommend(input, mock({ ...item, candidateId: 'missing' })), { code: 'AI_SCHEMA_MISMATCH' });
  await assert.rejects(ai.recommend(input, mock(item, { ...item, candidateId: 'b' })), { code: 'AI_SCHEMA_MISMATCH' });
  await assert.rejects(ai.recommend({ ...input, maxResults: 2 }, mock(item, item)), { code: 'AI_SCHEMA_MISMATCH' });
  assert.deepEqual(await ai.recommend({ ...input, candidates: [] }, async () => assert.fail('no candidates')),
    { recommendations: [] });
});

test('AI rejects invalid input before calling Gemini', async () => {
  const request = async () => assert.fail('invalid input was sent to Gemini');
  await assert.rejects(ai.extract({ input: ' ', schema: z.object({}) }, request), z.ZodError);
  await assert.rejects(ai.classify({ text: 'Hello', categories: [] }, request), z.ZodError);
  await assert.rejects(ai.classify({ text: 'Hello', categories: ['OTHER', 'OTHER'] }, request),
    { code: 'INVALID_INPUT' });
  await assert.rejects(ai.recommend({ candidates: [{ id: 'a' }, { id: 'a' }], criteria: 'Test' }, request),
    { code: 'INVALID_INPUT' });
  await assert.rejects(ai.recommend({ candidates: [{ id: 'a' }], criteria: 'Test', maxResults: 0 }, request), z.ZodError);
});

test('AI surfaces safe errors for Gemini failures and malformed outputs', async () => {
  const input = { input: 'A test message.', schema: z.object({ value: z.string() }) };
  await assert.rejects(ai.extract(input, async () => new Response(null, { status: 503 })), { code: 'AI_UNAVAILABLE' });
  await assert.rejects(ai.extract(input, async () => new Response(null, { status: 429 })), { code: 'AI_RATE_LIMITED' });
  await assert.rejects(ai.extract(input, async () => { throw new DOMException('timed out', 'TimeoutError'); }),
    { code: 'AI_TIMEOUT' });
  await assert.rejects(ai.extract(input, async () => geminiReply('not JSON')), { code: 'AI_INVALID_JSON' });
  await assert.rejects(ai.extract(input, async () => Response.json({})), { code: 'AI_EMPTY_RESPONSE' });
});

test('AI without a Gemini key fails clearly and the chatbot still serves FAQ', () => {
  const run = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { ai } from './src/modules/ai/ai.service.ts';
    import { chat } from './src/modules/chatbot/chatbot.service.ts';
    const request = async () => { throw new Error('Unexpected call to Gemini'); };
    const code = await ai.classify({ text: 'Hello', categories: ['OTHER'] }, request).catch(error => error.code);
    console.log(JSON.stringify([code, (await chat('password', request)).provider]));
  `], { encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), ['AI_UNAVAILABLE', 'faq']);
});

test('shared Gemini transport caps calls per process and uses the default model', () => {
  const run = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import { generateGemini } from './src/modules/ai/gemini.ts';
    let calls = 0;
    let endpoint;
    const request = async url => {
      endpoint = String(url);
      calls++;
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }] });
    };
    const input = { input: 'Hello', instructions: 'Say hello.', maxOutputTokens: 16 };
    for (let i = 0; i < 30; i++) await generateGemini(input, request);
    const blocked = await generateGemini(input, request).catch(error => error.code);
    console.log(JSON.stringify({ calls, endpoint, blocked }));
  `], { encoding: 'utf8', env: { ...process.env, GEMINI_MODEL: '' } });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    calls: 30, blocked: 'AI_RATE_LIMITED',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
  });
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

