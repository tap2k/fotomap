import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:.data/fotomap.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
