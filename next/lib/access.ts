import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db, channels, type ChannelRow, type Role, type User } from '@/lib/db';
import { getUser } from '@/lib/auth';
import { sha256 } from '@/lib/crypto';
import { fail } from '@/lib/http';

export type Action = 'view' | 'submit' | 'edit' | 'manage';
export type Actor = { user: User | null; key: string | null };

const ROLE_ACTIONS: Record<Role, Action[]> = {
  owner: ['view', 'submit', 'edit', 'manage'],
  editor: ['view', 'submit', 'edit'],
  viewer: ['view'],
  submitter: ['submit'],
};

/** Pure permission rule: what the given roles allow on a channel with this visibility. */
export function permits(roles: Role[], visibility: ChannelRow['visibility'], action: Action): boolean {
  if (action === 'view' && visibility !== 'private') return true;
  return roles.some((r) => ROLE_ACTIONS[r].includes(action));
}

/** The signed-in user plus any share key sent with the request (header or ?key=). */
export async function getActor(key?: string | null): Promise<Actor> {
  const h = await headers();
  return { user: await getUser(), key: key ?? h.get('x-share-key') };
}

/** Roles the actor holds on a channel, including grants inherited from ancestors. */
export async function rolesFor(actor: Actor, channelId: string): Promise<Role[]> {
  if (actor.user?.isAdmin) return ['owner'];
  if (!actor.user && !actor.key) return [];
  const userId = actor.user?.id ?? null;
  const tokenHash = actor.key ? sha256(actor.key) : null;
  const rows = await db.all<{ role: Role }>(sql`
    WITH RECURSIVE chain(id, parent_id, depth) AS (
      SELECT id, parent_id, 0 FROM channels WHERE id = ${channelId}
      UNION ALL
      SELECT c.id, c.parent_id, chain.depth + 1 FROM channels c JOIN chain ON c.id = chain.parent_id
      WHERE chain.depth < 32
    )
    SELECT g.role AS role FROM grants g JOIN chain ON g.channel_id = chain.id
    WHERE g.user_id = ${userId} OR g.token_hash = ${tokenHash}`);
  return [...new Set(rows.map((r) => r.role))];
}

export async function can(actor: Actor, channel: ChannelRow, action: Action) {
  return permits(await rolesFor(actor, channel.id), channel.visibility, action);
}

/** Loads a channel and asserts the actor may perform `action`; 404 hides private channels. */
export async function requireChannel(idOrSlug: string, action: Action, actor?: Actor) {
  actor ??= await getActor();
  const [channel] = await db
    .select()
    .from(channels)
    .where(sql`${channels.id} = ${idOrSlug} OR ${channels.slug} = ${idOrSlug}`);
  if (!channel) fail(404, 'Not found');
  const roles = await rolesFor(actor, channel.id);
  if (!permits(roles, channel.visibility, action)) {
    if (!permits(roles, channel.visibility, 'view') && !roles.includes('submitter')) fail(404, 'Not found');
    fail(actor.user || actor.key ? 403 : 401, 'Not allowed');
  }
  return { channel, roles, actor };
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) fail(401, 'Sign in required');
  return user;
}
