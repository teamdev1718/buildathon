import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';

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


const conflict = (error: unknown) => typeof error === 'object' && error !== null &&
  (('code' in error && error.code === 'P2034') || ('message' in error && /could not serialize|deadlock detected/i.test(String(error.message))));

/**
 * Runs a transaction at the strictest isolation level, so check-then-write rules such as "never overpay" hold under
 * concurrent requests. PostgreSQL may abort one of two racing transactions; those are retried, not shown as errors.
 */
export async function runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 30_000 });
    } catch (error) {
      if (attempt >= 4 || !conflict(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, 40 * attempt + Math.random() * 60));
    }
  }
}
