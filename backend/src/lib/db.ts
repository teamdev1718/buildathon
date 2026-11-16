import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === 'production' ? 5 : 3,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
export const db = new PrismaClient({ adapter });

export async function checkDatabase() {
  await db.$queryRaw`SELECT 1 FROM "app_private"."Role" WHERE name = 'USER'`.then(rows => {
    if (!Array.isArray(rows) || !rows.length) throw new Error('Apply Prisma migrations.');
  });
}

