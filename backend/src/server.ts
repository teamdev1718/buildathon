import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { app, frontendDist } from './app.js';
import { env, production } from './config/env.js';
import { checkDatabase, db } from './lib/db.js';
import { log } from './lib/http.js';

if (production) {
  try {
    await access(join(frontendDist, 'index.html'));
  } catch {
    log('startup.frontend_build_missing');
    process.exit(1);
  }
}

try {
  await db.$connect();
  await checkDatabase();
} catch {
  log('startup.database_unavailable');
  await db.$disconnect();
  process.exit(1);
}

const server = app.listen(env.PORT, '0.0.0.0', () => log('startup.listening', { port: env.PORT }));
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(async error => {
      try {
        await db.$disconnect();
        process.exitCode = error ? 1 : 0;
      } catch {
        process.exitCode = 1;
      } finally {
        clearTimeout(timer);
      }
    });
  });
}

