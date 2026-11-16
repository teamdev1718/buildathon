import argon2 from 'argon2';
import type { z } from 'zod';
import { emailAvailable, env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { db } from '../../lib/db.js';
import { ApiError, log } from '../../lib/http.js';
import { secret } from '../../lib/secrets.js';
import { emailService } from '../email/email.service.js';
import { invalidOtp, issueOtp, redeemOtp } from '../otp/otp.service.js';
import type { loginInput, loginOtpInput, otpInput, registration, resetInput } from './auth.schema.js';
import { createSession } from './session.service.js';

const hash = (password: string) => argon2.hash(password, { type: argon2.argon2id });
const dummyHash = hash(secret());
const invalidCredentials = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
const accepted = { ok: true };
const defaultRole = { create: { role: { connect: { name: 'USER' } } } };
export { defaultRole };

function ensureEmail() {
  if (!emailAvailable) throw new ApiError(503, 'EMAIL_UNAVAILABLE', 'Email delivery is unavailable.');
}

export async function register(input: z.output<typeof registration>) {
  ensureEmail();
  const { password, ...profile } = input;
  const passwordHash = await hash(password);
  try {
    const user = await db.user.create({ data: { ...profile, passwordHash, roles: defaultRole } });
    await issueOtp(user, 'VERIFY_EMAIL');
  } catch (error) {
    if (!isUnique(error)) throw error;
  }
  return accepted;
}

export function isUnique(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export async function requestCode(email: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
  ensureEmail();
  const dispatch = async () => {
    const user = await db.user.findUnique({ where: { email } });
    if (user && (purpose === 'VERIFY_EMAIL' ? !user.verifiedAt : Boolean(user.passwordHash))) {
      await issueOtp(user, purpose);
    }
  };
  // Keep account lookup and email delivery latency out of the public response.
  if (env.EMAIL_PROVIDER === 'mock') await dispatch();
  else void dispatch().catch(() => log('auth.code_dispatch_failed', { purpose }));
  return accepted;
}

export async function verifyEmail(input: z.output<typeof otpInput>) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user || user.verifiedAt) throw invalidOtp();
  await redeemOtp(user.id, 'VERIFY_EMAIL', input.code, async tx => {
    await tx.user.update({ where: { id: user.id }, data: { verifiedAt: new Date() } });
    await tx.auditEvent.create({ data: { userId: user.id, action: 'email.verified' } });
  });
  await emailService.send({ to: user.email, subject: 'Welcome', template: 'welcome', data: user.name,
    key: 'welcome/' + user.id }).catch(() => {});
  return accepted;
}

async function validatePassword(input: z.output<typeof loginInput>) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  const valid = await argon2.verify(user?.passwordHash ?? await dummyHash, input.password);
  if (!user?.passwordHash || !valid) throw invalidCredentials();
  if (!user.verifiedAt) throw new ApiError(403, 'EMAIL_UNVERIFIED', 'Verify your email before signing in.');
  return user;
}

async function passwordSession(tx: Prisma.TransactionClient, user: Awaited<ReturnType<typeof validatePassword>>) {
  // Match the checked hash under a row lock so password reset cannot leave a later stale-password session active.
  const rows = await tx.$queryRaw<unknown[]>`SELECT id FROM "app_private"."User"
    WHERE id = ${user.id} AND "passwordHash" = ${user.passwordHash} FOR UPDATE`;
  if (!rows.length) throw invalidCredentials();
  return createSession(user.id, tx);
}

export async function login(input: z.output<typeof loginInput>) {
  const user = await validatePassword(input);
  if (env.ENABLE_LOGIN_OTP) {
    await issueOtp(user, 'LOGIN');
    return { otpRequired: true } as const;
  }
  return db.$transaction(tx => passwordSession(tx, user));
}

export async function completeLogin(input: z.output<typeof loginOtpInput>) {
  if (!env.ENABLE_LOGIN_OTP) throw new ApiError(404, 'NOT_FOUND', 'Sign-in codes are disabled.');
  const user = await validatePassword(input);
  return redeemOtp(user.id, 'LOGIN', input.code, tx => passwordSession(tx, user));
}

export async function resetPassword(input: z.output<typeof resetInput>) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user?.passwordHash) throw invalidOtp();
  await redeemOtp(user.id, 'RESET_PASSWORD', input.code, async tx => {
    const passwordHash = await hash(input.password);
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditEvent.create({ data: { userId: user.id, action: 'password.reset' } });
  });
  return accepted;
}

