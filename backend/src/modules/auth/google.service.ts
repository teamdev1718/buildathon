import type { Request, Response } from 'express';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { z } from 'zod';
import { env, googleEnabled, production } from '../../config/env.js';
import { ApiError, log } from '../../lib/http.js';
import { db } from '../../lib/db.js';
import { digest, equal, secret } from '../../lib/secrets.js';
import { email } from './auth.schema.js';
import { defaultRole, isUnique } from './auth.service.js';
import { createSession, sendSession } from './session.service.js';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);
const cookie = production ? '__Host-google-oauth' : 'google_oauth';
const options = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' } as const;
const disabled = () => new ApiError(404, 'GOOGLE_DISABLED', 'Google sign-in is unavailable.');

export function beginGoogle(res: Response) {
  if (!googleEnabled) throw disabled();
  const state = secret();
  const verifier = secret();
  const nonce = secret();
  res.cookie(cookie, [state, verifier, nonce].join('.'), { ...options, maxAge: 600_000 });
  res.redirect(client.generateAuthUrl({
    scope: ['openid', 'email', 'profile'], state, nonce, code_challenge: digest(verifier),
    code_challenge_method: CodeChallengeMethod.S256,
  }));
}

export async function finishGoogle(req: Request, res: Response) {
  if (!googleEnabled) throw disabled();
  res.clearCookie(cookie, options);
  const value: unknown = req.cookies[cookie];
  const [state, verifier, nonce] = typeof value === 'string' ? value.split('.') : [];
  const query = z.object({ state: z.string().length(43), code: z.string().min(1).max(2048) }).safeParse(req.query);
  if (!query.success || !state || !verifier || !nonce || !equal(query.data.state, state)) {
    res.redirect(env.APP_ORIGIN + '/login?google=failed');
    return;
  }
  try {
    const { tokens } = await client.getToken({ code: query.data.code, codeVerifier: verifier });
    if (!tokens.id_token) throw new Error('Missing ID token');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || payload.email_verified !== true || payload.nonce !== nonce) throw new Error('Invalid identity');
    const address = email.parse(payload.email);
    const subject = { provider: 'google', subject: payload.sub };
    let identity = await db.oAuthIdentity.findUnique({ where: { provider_subject: subject } });
    if (!identity) {
      try {
        identity = await db.oAuthIdentity.create({ data: { ...subject, user: { create: {
          email: address, name: payload.name?.trim().slice(0, 100) || 'Google user',
          verifiedAt: new Date(), roles: defaultRole,
        } } } });
      } catch (error) {
        if (!isUnique(error)) throw error;
        identity = await db.oAuthIdentity.findUnique({ where: { provider_subject: subject } });
      }
    }
    if (!identity) {
      // Existing local accounts require an authenticated linking ceremony.
      res.redirect(env.APP_ORIGIN + '/login?google=account-exists');
      return;
    }
    await sendSession(res, await createSession(identity.userId));
    res.redirect(env.APP_ORIGIN + '/dashboard');
  } catch {
    log('oauth.google_failed');
    res.redirect(env.APP_ORIGIN + '/login?google=failed');
  }
}

