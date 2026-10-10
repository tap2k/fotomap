// One-off import from the old Strapi database.
//
//   STRAPI_DATABASE_URL=postgres://user:pass@host:5432/mvc \
//   STRAPI_MEDIA_URL=https://old-strapi.example.org \
//   npm run migrate:strapi
//
// STRAPI_MEDIA_URL prefixes relative file URLs (/uploads/...). Files are not copied:
// items keep pointing at where Strapi stored them. Run against an empty Fotomap database
// (after `npm run db:migrate`).

import pg from 'pg';
import { sql } from 'drizzle-orm';
import { db, users, channels, items, grants } from '../lib/db';
import { STRAPI_TABLES, transformStrapi, type StrapiSnapshot } from '../lib/migrate-strapi';

async function main() {
  const url = process.env.STRAPI_DATABASE_URL;
  if (!url) throw new Error('Set STRAPI_DATABASE_URL');
  const [{ n }] = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM channels`);
  if (n > 0 && !process.argv.includes('--force')) throw new Error('Target database already has channels. Use an empty database (or --force to add anyway).');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const snapshot: StrapiSnapshot = {};
  for (const table of STRAPI_TABLES) {
    try {
      snapshot[table] = (await client.query(`SELECT * FROM "${table}"`)).rows;
    } catch {
      console.warn(`  (table ${table} not found, skipping)`);
      snapshot[table] = [];
    }
  }
  await client.end();

  const out = transformStrapi(snapshot, { mediaBase: process.env.STRAPI_MEDIA_URL ?? '' });

  // Existing users (e.g. someone already signed in) are matched by email.
  const existing = new Map((await db.select().from(users)).map((u) => [u.email, u.id]));
  const remap = new Map<string, string>();
  const newUsers = out.users.filter((u) => {
    const id = existing.get(u.email);
    if (id) remap.set(u.id, id);
    return !id;
  });
  const fix = (id: string) => remap.get(id) ?? id;

  await db.transaction(async (tx) => {
    for (const chunk of chunks(newUsers)) await tx.insert(users).values(chunk);
    // Parents before children so self-references are valid.
    const ordered = [...out.channels].sort((a, b) => depth(a, out.channels) - depth(b, out.channels));
    for (const chunk of chunks(ordered)) await tx.insert(channels).values(chunk.map((c) => ({ ...c, ownerId: fix(c.ownerId) })));
    for (const chunk of chunks(out.items)) await tx.insert(items).values(chunk);
    for (const chunk of chunks(out.grants)) await tx.insert(grants).values(chunk.map((g) => ({ ...g, userId: g.userId && fix(g.userId) })));
  });

  console.log(`Imported ${out.users.length} users (${newUsers.length} new), ${out.channels.length} channels, ${out.items.length} items, ${out.grants.length} grants.`);
  for (const w of out.warnings) console.log(`  ! ${w}`);
}

const chunks = <T,>(list: T[], size = 200) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

function depth(c: { id: string; parentId?: string | null }, all: { id: string; parentId?: string | null }[]): number {
  let d = 0;
  for (let p = c.parentId; p && d < 32; d++) p = all.find((x) => x.id === p)?.parentId;
  return d;
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err.message ?? err);
    process.exit(1);
  },
);
