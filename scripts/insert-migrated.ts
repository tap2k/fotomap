// Shared by migrate-strapi.ts and import-channel.ts: write transformed rows into the v2 database.
import { db, users, channels, items, grants } from '../lib/db';
import type { Migrated } from '../lib/migrate-strapi';

export async function insertMigrated(out: Migrated) {
  // Existing users (e.g. someone already signed in) are matched by email.
  const existing = new Map((await db.select().from(users)).map((u) => [u.email, u.id]));
  const remap = new Map<string, string>();
  const newUsers = out.users.filter((u) => {
    const id = existing.get(u.email);
    if (id) remap.set(u.id, id);
    return !id;
  });
  const fix = (id: string) => remap.get(id) ?? id;
  const depth = (c: { parentId?: string | null }): number => {
    let d = 0;
    for (let p = c.parentId; p && d < 32; d++) p = out.channels.find((x) => x.id === p)?.parentId;
    return d;
  };

  await db.transaction(async (tx) => {
    for (const chunk of chunks(newUsers)) await tx.insert(users).values(chunk);
    // Parents before children so self-references are valid.
    const ordered = [...out.channels].sort((a, b) => depth(a) - depth(b));
    for (const chunk of chunks(ordered)) await tx.insert(channels).values(chunk.map((c) => ({ ...c, ownerId: fix(c.ownerId) })));
    for (const chunk of chunks(out.items)) await tx.insert(items).values(chunk);
    for (const chunk of chunks(out.grants)) await tx.insert(grants).values(chunk.map((g) => ({ ...g, userId: g.userId && fix(g.userId) })));
  });
  return { newUsers: newUsers.length };
}

const chunks = <T,>(list: T[], size = 200) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
