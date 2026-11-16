import { z } from 'zod';
import { env } from '../src/config/env.js';
import { db } from '../src/lib/db.js';

try {
  if (env.NODE_ENV === 'production') throw new Error('The development seed is disabled in production.');
  const email = z.email().parse((process.env.DEV_SEED_ADMIN_EMAIL ?? '').trim().toLowerCase());
  const user = await db.user.findFirstOrThrow({ where: { email, verifiedAt: { not: null } } });
  await db.userRole.upsert({ where: { userId_roleName: { userId: user.id, roleName: 'ADMIN' } },
    create: { userId: user.id, roleName: 'ADMIN' }, update: {} });
  console.log('Granted ADMIN to the configured verified development account.');
} catch {
  console.error('Development seed requires DEV_SEED_ADMIN_EMAIL for a verified account in the development database.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}

