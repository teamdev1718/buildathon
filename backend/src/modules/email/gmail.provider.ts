import { randomUUID } from 'node:crypto';
import { z } from 'zod';

type GmailCredentials = { clientId: string; clientSecret: string; refreshToken: string; from: string };
type Message = { to: string; subject: string; text: string; html: string };
const tokenResponse = z.object({
  access_token: z.string().regex(/^[A-Za-z0-9._~+\/-]+=*$/),
  expires_in: z.number().int().positive(),
});
const acceptedMessage = z.object({ id: z.string().min(1) });
const mailbox = z.email().refine(value => !/[\r\n]/.test(value));

function base64Body(value: string) {
  return Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function mimeMessage(from: string, { to, subject, text, html }: Message) {
  const boundary = 'buildathon_' + randomUUID();
  const encodedSubject = (subject.match(/.{1,10}/gsu) ?? []).map(part =>
    '=?UTF-8?B?' + Buffer.from(part, 'utf8').toString('base64') + '?=').join('\r\n ');
  const mime = [
    'From: ' + mailbox.parse(from),
    'To: ' + mailbox.parse(to),
    'Subject: ' + encodedSubject,
    'Date: ' + new Date().toUTCString(),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(text),
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(html),
    '--' + boundary + '--',
    '',
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64url');
}

export function createGmailProvider(credentials: GmailCredentials, request = fetch) {
  let cached: { value: string; expiresAt: number } | undefined;
  let refreshing: Promise<string> | undefined;

  async function refresh() {
    const response = await request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Gmail OAuth refresh failed');
    }
    const token = tokenResponse.safeParse(await response.json());
    if (!token.success) throw new Error('Invalid Gmail OAuth response');
    cached = { value: token.data.access_token, expiresAt: Date.now() + token.data.expires_in * 1000 };
    return cached.value;
  }

  function accessToken() {
    if (cached && cached.expiresAt > Date.now() + 60_000) return Promise.resolve(cached.value);
    refreshing ??= refresh().finally(() => { refreshing = undefined; });
    return refreshing;
  }

  return {
    async send(message: Message) {
      const raw = mimeMessage(credentials.from, message);
      const token = await accessToken();
      const response = await request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
        redirect: 'error',
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) {
        if (response.status === 401 && cached?.value === token) cached = undefined;
        await response.body?.cancel();
        throw new Error('Gmail send failed');
      }
      if (!acceptedMessage.safeParse(await response.json()).success) throw new Error('Invalid Gmail send response');
    },
  };
}
