import { env, emailAvailable } from '../../config/env.js';
import { ApiError, log } from '../../lib/http.js';

const escape = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const templates = {
  verification: (value: string) => 'Your email verification code is ' + value + '. It expires in 10 minutes.',
  reset: (value: string) => 'Your password reset code is ' + value + '. It expires in 10 minutes.',
  login: (value: string) => 'Your sign-in code is ' + value + '. It expires in 10 minutes.',
  welcome: (value: string) => 'Welcome, ' + value + '!',
  notification: (value: string) => value,
};

type Email = { to: string; subject: string; template: keyof typeof templates; data: string; key: string };
type MockEmail = { to: string; subject: string; text: string };
const mailbox: MockEmail[] = [];

export const emailService = {
  readMock(to: string) {
    return mailbox.filter(message => message.to === to);
  },

  async send({ to, subject, template, data, key }: Email) {
    if (!emailAvailable) throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Email delivery is unavailable.');
    const text = templates[template](data);
    if (env.EMAIL_PROVIDER === 'mock') {
      mailbox.push({ to, subject, text });
      if (mailbox.length > 100) mailbox.shift();
      return { status: 'MOCKED' as const };
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json',
            'Idempotency-Key': key },
          body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html: '<p>' + escape(text) + '</p>' }),
          signal: AbortSignal.timeout(4000),
        });
        await response.body?.cancel();
        if (response.ok) return { status: 'ACCEPTED' as const };
        if (response.status < 500) break;
      } catch {
        // Safe retry with the same Resend idempotency key.
      }
    }
    log('email.failed', { template });
    throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Email delivery is temporarily unavailable.');
  },
};

