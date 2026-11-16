import type { Request, RequestHandler } from 'express';
import { ApiError } from '../lib/http.js';
import { authenticate } from '../modules/auth/session.service.js';

declare module 'express-serve-static-core' {
  interface Request { user?: Awaited<ReturnType<typeof authenticate>> }
}

export function currentUser(req: Request) {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
  return req.user;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  req.user = await authenticate(req.get('authorization'));
  next();
};

function requireGrant(field: 'roles' | 'permissions', value: string): RequestHandler {
  return (req, _res, next) => {
    if (!currentUser(req)[field].includes(value)) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
    next();
  };
}

export const requireRole = (role: string) => requireGrant('roles', role);
export const requirePermission = (permission: string) => requireGrant('permissions', permission);

