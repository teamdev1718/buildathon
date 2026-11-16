import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
import { env, production } from './config/env.js';
import { api, openapi } from './lib/api.js';
import { checkDatabase } from './lib/db.js';
import { ApiError, handleError, limiter, requestLog } from './lib/http.js';
import { equal } from './lib/secrets.js';
import { email } from './modules/auth/auth.schema.js';
import { emailService } from './modules/email/email.service.js';
import './modules/auth/auth.routes.js';
import './modules/users/users.routes.js';
import './modules/chatbot/chatbot.routes.js';
import './modules/telegram/telegram.routes.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(requestLog, helmet({ strictTransportSecurity: production ? undefined : false,
  contentSecurityPolicy: { directives: { upgradeInsecureRequests: production ? [] : null } } }));
app.get(['/health', '/api/health'], (_req, res) => res.json({ status: 'ok' }));
app.get(['/ready', '/api/ready'], async (_req, res) => {
  try {
    await checkDatabase();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
app.get('/api/openapi.json', (_req, res) => res.json(openapi));
app.get(/^\/api\/docs$/, (_req, res) => res.redirect('/api/docs/'));
app.get('/api/docs/', (_req, res) => res.type('html').send(
  '<!doctype html><html lang="en"><title>Buildathon API</title>' +
  '<link rel="stylesheet" href="./assets/swagger-ui.css"><div id="swagger-ui"></div>' +
  '<script src="./assets/swagger-ui-bundle.js" defer></script><script src="./init.js" defer></script></html>',
));
app.get('/api/docs/init.js', (_req, res) => res.type('js').send(
  'SwaggerUIBundle({url:"/api/openapi.json",dom_id:"#swagger-ui",validatorUrl:null,supportedSubmitMethods:[]});',
));
const swagger = createRequire(import.meta.url)('swagger-ui-dist') as { getAbsoluteFSPath(): string };
app.use('/api/docs/assets', express.static(swagger.getAbsoluteFSPath()));

if (env.NODE_ENV === 'development' && env.EMAIL_PROVIDER === 'mock' && env.MOCK_INBOX_KEY) {
  const key = env.MOCK_INBOX_KEY;
  app.get('/api/dev/inbox', limiter(20, 60_000), (req, res) => {
    if (!equal(req.get('X-Mock-Inbox-Key') ?? '', key)) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
    }
    res.set('Cache-Control', 'no-store').json(emailService.readMock(email.parse(req.query.email)));
  });
}

app.use('/api/v1', limiter(240, 60_000), (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.path !== '/integrations/telegram/webhook' &&
      (req.get('origin') !== env.APP_ORIGIN || !req.is('application/json'))) {
    return next(new ApiError(403, 'ORIGIN_DENIED', 'Send JSON from the application origin.'));
  }
  next();
}, express.json({ limit: '32kb' }), cookieParser(), api);
app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'API route not found.')));

export const frontendDist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
app.use('/assets', express.static(join(frontendDist, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(frontendDist, { index: false }));
app.get('/{*page}', (req, res, next) => {
  if (req.path.startsWith('/assets/') || extname(req.path) || !req.accepts('html')) return next();
  res.set('Cache-Control', 'no-cache');
  res.sendFile(join(frontendDist, 'index.html'), error => {
    if (error && 'code' in error && error.code === 'ENOENT') return next();
    if (error) next(error);
  });
});
app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')));
app.use(handleError);

