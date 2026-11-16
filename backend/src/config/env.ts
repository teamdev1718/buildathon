import 'dotenv/config';
import { z } from 'zod';

const flag = z.enum(['true', 'false']).default('false').transform(value => value === 'true');
const optional = z.string().optional();
const postgres = z.url({ protocol: /^postgres(?:ql)?$/ });
const parsed = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: postgres,
  DIRECT_URL: postgres.optional(),
  JWT_SECRET: z.string().min(32),
  OTP_SECRET: z.string().min(32),
  ENABLE_LOGIN_OTP: flag,
  EMAIL_PROVIDER: z.enum(['gmail', 'mock', 'disabled', 'resend']).default('disabled')
    .transform(value => value === 'resend' ? 'disabled' : value),
  MOCK_INBOX_KEY: z.string().min(32).optional(),
  EMAIL_FROM: optional,
  GMAIL_CLIENT_ID: optional,
  GMAIL_CLIENT_SECRET: optional,
  GMAIL_REFRESH_TOKEN: optional,
  ENABLE_GOOGLE_AUTH: flag,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_CALLBACK_URL: optional,
  ENABLE_TELEGRAM: flag,
  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_WEBHOOK_SECRET: optional,
  TELEGRAM_BOT_USERNAME: optional,
  CHATBOT_PROVIDER: z.enum(['faq', 'gemini']).default('faq'),
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: z.string().regex(/^[\w.-]+$/).optional(),
}).safeParse(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== '')));

if (!parsed.success) {
  throw new Error('Invalid configuration: ' + parsed.error.issues.map(issue => issue.path.join('.')).join(', '));
}
const settings = parsed.data;
const appOrigin = new URL(settings.APP_ORIGIN).origin;
if (!/^https?:\/\//.test(settings.APP_ORIGIN) ||
    (settings.APP_ORIGIN !== appOrigin && settings.APP_ORIGIN !== appOrigin + '/')) {
  throw new Error('APP_ORIGIN must be the app URL with no path, query, or fragment.');
}
export const env = { ...settings, APP_ORIGIN: appOrigin };
export const production = env.NODE_ENV === 'production';
if (production && !env.APP_ORIGIN.startsWith('https://')) {
  throw new Error('APP_ORIGIN must be the public HTTPS app URL in production.');
}
if (env.JWT_SECRET === env.OTP_SECRET) {
  throw new Error('JWT_SECRET and OTP_SECRET must be different.');
}
if (production && env.EMAIL_PROVIDER === 'mock') {
  throw new Error('EMAIL_PROVIDER must be gmail or disabled in production.');
}
export const googleEnabled = Boolean(env.ENABLE_GOOGLE_AUTH && env.GOOGLE_CLIENT_ID &&
  env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL === env.APP_ORIGIN + '/api/v1/auth/google/callback');
export const telegramEnabled = Boolean(env.ENABLE_TELEGRAM && env.TELEGRAM_BOT_TOKEN &&
  /^[A-Za-z0-9_-]{16,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET ?? '') &&
  /^[A-Za-z0-9_]{5,32}$/.test(env.TELEGRAM_BOT_USERNAME ?? ''));
export const emailAvailable = env.EMAIL_PROVIDER === 'mock' ||
  Boolean(env.EMAIL_PROVIDER === 'gmail' && env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET &&
    env.GMAIL_REFRESH_TOKEN && !/[\r\n]/.test(env.EMAIL_FROM ?? '') && z.email().safeParse(env.EMAIL_FROM).success);

