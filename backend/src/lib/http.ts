import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function log(event: string, fields: Record<string, string | number> = {}) {
  if (process.env.NODE_ENV !== 'test') console.log(JSON.stringify({ event, ...fields }));
}

export const requestLog: RequestHandler = (req, res, next) => {
  const id = randomUUID();
  const start = performance.now();
  res.setHeader('X-Request-Id', id);
  res.on('finish', () => log('http.request', {
    id, method: req.method, status: res.statusCode, durationMs: Math.round(performance.now() - start),
  }));
  next();
};

export const handleError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const normalized = error instanceof ApiError ? error :
    error instanceof z.ZodError ? new ApiError(400, 'INVALID_INPUT', 'Check the submitted fields.') :
    error?.type === 'entity.parse.failed' ? new ApiError(400, 'INVALID_JSON', 'Invalid JSON body.') :
    error?.type === 'entity.too.large' ? new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.') :
    new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong.');
  const requestId = String(res.getHeader('X-Request-Id') ?? '');
  if (normalized.status === 500) log('http.error', { requestId, kind: error?.constructor?.name ?? 'Unknown' });
  res.status(normalized.status).json({
    error: { code: normalized.code, message: normalized.message, requestId,
      ...(error instanceof z.ZodError ? { fields: error.issues.map(issue => issue.path.join('.')) } : {}) },
  });
};

export function limiter(limit: number, windowMs: number) {
  return rateLimit({
    limit, windowMs, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.')),
  });
}

