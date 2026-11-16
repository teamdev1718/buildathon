import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (databaseUrl && !URL.canParse(databaseUrl)) {
  throw new Error('DIRECT_URL or DATABASE_URL must be a valid PostgreSQL URL.');
}
const migrationUrl = databaseUrl ? new URL(databaseUrl) : undefined;
migrationUrl?.searchParams.set('schema', 'app_private');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: migrationUrl?.toString() },
});

