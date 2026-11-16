import { env, emailAvailable } from '../../config/env.js';
import { ApiError, log } from '../../lib/http.js';
import { createGmailProvider } from './gmail.provider.js';

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
const gmail = env.EMAIL_PROVIDER === 'gmail' && emailAvailable &&
  env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN && env.EMAIL_FROM
  ? createGmailProvider({ clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET,
      refreshToken: env.GMAIL_REFRESH_TOKEN, from: env.EMAIL_FROM })
  : undefined;

export const emailService = {
  readMock(to: string) {
    return mailbox.filter(message => message.to === to);
  },

  async send({ to, subject, template, data }: Email) {
    if (!emailAvailable) throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Email delivery is unavailable.');
    const text = templates[template](data);
    if (env.EMAIL_PROVIDER === 'mock') {
      mailbox.push({ to, subject, text });
      if (mailbox.length > 100) mailbox.shift();
      return { status: 'MOCKED' as const };
    }
    if (!gmail) throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Email delivery is unavailable.');
    try {
      await gmail.send({ to, subject, text, html: '<p>' + escape(text) + '</p>' });
      return { status: 'ACCEPTED' as const };
    } catch {
      // An ambiguous Gmail send failure can still mean the message was accepted.
      log('email.failed', { template });
      throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Email delivery is temporarily unavailable.');
    }
  },
};

