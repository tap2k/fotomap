// Runs once when the server starts: bring the database schema up to date.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { db } = await import('@/lib/db');
  await migrate(db, { migrationsFolder: 'drizzle' });
}
