import { createHmac, randomInt } from 'node:crypto';
import { env } from '../../config/env.js';
import type { OtpPurpose, Prisma } from '../../generated/prisma/client.js';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { equal, secret } from '../../lib/secrets.js';
import { emailService } from '../email/email.service.js';

const settings = {
  VERIFY_EMAIL: { template: 'verification', subject: 'Verify your email' },
  RESET_PASSWORD: { template: 'reset', subject: 'Reset your password' },
  LOGIN: { template: 'login', subject: 'Your sign-in code' },
} as const;
const maxAttempts = 5;
const otpDigest = (nonce: string, code: string) =>
  createHmac('sha256', env.OTP_SECRET).update(nonce + '.' + code).digest('base64url');

export async function issueOtp(user: { id: string; email: string }, purpose: OtpPurpose) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const nonce = secret();
  const issuedAt = new Date();
  const expiresAt = new Date(+issuedAt + 600_000);
  const key = { userId: user.id, purpose };
  const data = { nonce, digest: otpDigest(nonce, code), issuedAt, expiresAt, consumedAt: null, attempts: 0 };
  const replaced = await db.otpChallenge.updateMany({
    where: { ...key, OR: [{ issuedAt: { lte: new Date(+issuedAt - 60_000) } }, { consumedAt: { not: null } }] },
    data,
  });
  if (!replaced.count && !(await db.otpChallenge.createMany({ data: { ...key, ...data }, skipDuplicates: true })).count) {
    return false;
  }
  try {
    await emailService.send({ to: user.email, ...settings[purpose], data: code, key: 'otp/' + nonce });
  } catch (error) {
    await db.otpChallenge.deleteMany({ where: { ...key, nonce } });
    throw error;
  }
  return true;
}

export async function redeemOtp<T>(userId: string, purpose: OtpPurpose, code: string,
  action: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const result = await db.$transaction(async tx => {
    const key = { userId, purpose };
    const challenge = await tx.otpChallenge.findUnique({ where: { userId_purpose: key } });
    if (!challenge) return { ok: false } as const;
    const now = new Date();
    const valid = equal(challenge.digest, otpDigest(challenge.nonce, code));
    const changed = await tx.otpChallenge.updateMany({
      where: { ...key, nonce: challenge.nonce, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: maxAttempts } },
      data: valid ? { consumedAt: now } : { attempts: { increment: 1 } },
    });
    if (!changed.count || !valid) return { ok: false } as const;
    return { ok: true, value: await action(tx) } as const;
  });
  if (!result.ok) throw invalidOtp();
  return result.value;
}

export const invalidOtp = () => new ApiError(400, 'INVALID_CODE', 'The code is invalid, expired, or used.');

