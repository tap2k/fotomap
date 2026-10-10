import { mkdirSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'file:.data/fotomap.db';
if (url.startsWith('file:')) mkdirSync('.data', { recursive: true });

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof drizzle<typeof schema>> };

export const db =
  globalForDb.db ??
  drizzle(createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN }), { schema });
if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

export * from './schema';
