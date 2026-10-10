import { beforeAll, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, users, channels, grants } from '@/lib/db';
import { rolesFor, type Actor } from '@/lib/access';
import { sha256 } from '@/lib/crypto';

const user = (id: string, isAdmin = false) => ({ id, email: `${id}@x.org`, name: null, plan: 'free' as const, isAdmin, createdAt: new Date() });
const actor = (u: ReturnType<typeof user> | null, key: string | null = null): Actor => ({ user: u, key });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(users).values([user('owner'), user('ed'), user('other')]);
  // root > child > grandchild
  await db.insert(channels).values([
    { id: 'root', slug: 'root', ownerId: 'owner', title: 'Root', visibility: 'private' },
    { id: 'child', slug: 'child', parentId: 'root', ownerId: 'owner', title: 'Child', visibility: 'private' },
    { id: 'grand', slug: 'grand', parentId: 'child', ownerId: 'owner', title: 'Grand', visibility: 'private' },
  ]);
  await db.insert(grants).values([
    { id: 'g1', channelId: 'root', role: 'owner', userId: 'owner' },
    { id: 'g2', channelId: 'child', role: 'editor', userId: 'ed' },
    { id: 'g3', channelId: 'grand', role: 'submitter', tokenHash: sha256('submit-secret') },
  ]);
});

describe('rolesFor', () => {
  it('inherits grants from every ancestor', async () => {
    expect(await rolesFor(actor(user('owner')), 'grand')).toEqual(['owner']);
    expect(await rolesFor(actor(user('ed')), 'grand')).toEqual(['editor']);
  });
  it('does not leak grants upwards', async () => {
    expect(await rolesFor(actor(user('ed')), 'root')).toEqual([]);
    expect(await rolesFor(actor(null, 'submit-secret'), 'child')).toEqual([]);
  });
  it('resolves share links by token', async () => {
    expect(await rolesFor(actor(null, 'submit-secret'), 'grand')).toEqual(['submitter']);
    expect(await rolesFor(actor(null, 'wrong'), 'grand')).toEqual([]);
  });
  it('gives nothing to strangers and everything to admins', async () => {
    expect(await rolesFor(actor(user('other')), 'grand')).toEqual([]);
    expect(await rolesFor(actor(null), 'grand')).toEqual([]);
    expect(await rolesFor(actor(user('admin', true)), 'grand')).toEqual(['owner']);
  });
});
