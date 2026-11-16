import { SignJWT, jwtVerify } from 'jose';
import type { Response } from 'express';
import { env, production } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { db } from '../../lib/db.js';
import { ApiError } from '../../lib/http.js';
import { digest, equal, secret } from '../../lib/secrets.js';

const jwtKey = new TextEncoder().encode(env.JWT_SECRET);
const sessionMs = 14 * 24 * 60 * 60 * 1000;
export const cookie = production ? '__Host-refresh' : 'refresh';
const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' } as const;
const tokenPattern = /^(?<id>[0-9a-f-]{36})\.(?<value>[\w-]{43})$/;
const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');

function parse(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const id = tokenPattern.exec(value)?.groups?.id;
  if (id) return { id, hash: digest(value.slice(37)) };
}

export async function createSession(userId: string, client: Prisma.TransactionClient = db) {
  const value = secret();
  const session = await client.refreshSession.create({
    data: { userId, tokenHash: digest(value), expiresAt: new Date(Date.now() + sessionMs) },
  });
  return { ...session, value };
}

export async function sendSession(res: Response, session: Awaited<ReturnType<typeof createSession>>) {
  const accessToken = await new SignJWT({ sid: session.id }).setProtectedHeader({ alg: 'HS256' })
    .setIssuer('buildathon-starter').setAudience('buildathon-api').setSubject(session.userId)
    .setIssuedAt().setExpirationTime('10m').sign(jwtKey);
  res.cookie(cookie, session.id + '.' + session.value, {
    ...cookieOptions, maxAge: Math.max(0, +session.expiresAt - Date.now()),
  });
  return { accessToken, expiresIn: 600 };
}

export async function refresh(token: unknown) {
  const input = parse(token);
  if (!input) throw unauthorized();
  const session = await db.refreshSession.findUnique({ where: { id: input.id } });
  if (!session || session.revokedAt || +session.expiresAt <= Date.now()) throw unauthorized();
  if (!equal(session.tokenHash, input.hash)) {
    if (session.previousHash && equal(session.previousHash, input.hash)) {
      if (session.rotatedAt && Date.now() - +session.rotatedAt <= 5000) {
        throw new ApiError(409, 'ROTATION_CONFLICT', 'The session was just refreshed. Try again.');
      }
      await db.refreshSession.updateMany({
        where: { id: session.id, previousHash: input.hash, revokedAt: null }, data: { revokedAt: new Date() },
      });
    }
    throw unauthorized();
  }
  const value = secret();
  const changed = await db.refreshSession.updateMany({
    where: { id: session.id, tokenHash: input.hash, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { tokenHash: digest(value), previousHash: input.hash, rotatedAt: new Date() },
  });
  if (!changed.count) throw new ApiError(409, 'ROTATION_CONFLICT', 'The session was just refreshed. Try again.');
  return { ...session, value };
}

export async function logout(token: unknown, res: Response) {
  const input = parse(token);
  if (input) await db.refreshSession.updateMany({
    where: { id: input.id, revokedAt: null, OR: [{ tokenHash: input.hash }, { previousHash: input.hash }] },
    data: { revokedAt: new Date() },
  });
  res.clearCookie(cookie, cookieOptions);
  return { ok: true };
}

export async function authenticate(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  const payload = await jwtVerify(header.slice(7), jwtKey, {
    algorithms: ['HS256'], issuer: 'buildathon-starter', audience: 'buildathon-api',
  }).then(result => result.payload, () => { throw unauthorized(); });
  if (typeof payload.sid !== 'string' || !payload.sub) throw unauthorized();
  const session = await db.refreshSession.findFirst({
    where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { user: { select: { id: true, name: true, email: true, verifiedAt: true,
      emailOptIn: true, telegramChatId: true,
      roles: { select: { role: { include: { permissions: true } } } },
    } } },
  });
  if (!session?.user.verifiedAt) throw unauthorized();
  const { roles, telegramChatId, ...user } = session.user;
  return { ...user, telegramConnected: Boolean(telegramChatId), roles: roles.map(({ role }) => role.name),
    permissions: [...new Set(roles.flatMap(({ role }) => role.permissions.map(item => item.permissionName)))] };
}

