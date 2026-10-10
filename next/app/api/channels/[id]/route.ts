import { eq, inArray, sql } from 'drizzle-orm';
import { db, channels, items, grants } from '@/lib/db';
import { fail, route } from '@/lib/http';
import { requireChannel } from '@/lib/access';
import { assertAllowed } from '@/lib/plans';
import { loadChannel } from '@/lib/channel';
import { storage } from '@/lib/storage';
import { fileKeyPrefix } from '@/lib/items';
import { channelInputSchema } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

/** The full channel for editors (drafts + notes), or the published view for everyone else. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { channel, roles } = await requireChannel((await params).id, 'view');
  return loadChannel(channel, { drafts: roles.some((r) => r === 'owner' || r === 'editor') });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { channel, roles } = await requireChannel((await params).id, 'edit');
  const input = channelInputSchema.partial().parse(await req.json());
  const owner = roles.includes('owner');
  if ((input.visibility || input.parentId !== undefined || input.domain !== undefined) && !owner) fail(403, 'Only owners can change sharing');
  if (input.domain) {
    if (channel.parentId) fail(400, 'Only top-level projects can have a domain');
    const [taken] = await db.select({ id: channels.id }).from(channels).where(eq(channels.domain, input.domain));
    if (taken && taken.id !== channel.id) fail(409, 'That domain is already used by another project');
  }
  if (input.parentId === null && channel.parentId) fail(400, 'Sub-channels stay inside a parent');
  if (input.parentId) {
    const { channel: parent } = await requireChannel(input.parentId, 'manage');
    if (parent.ownerId !== channel.ownerId) fail(400, 'Can only move within the same owner');
    if ((await descendants(channel.id)).includes(parent.id)) fail(400, 'Cannot move a channel inside itself');
  }
  if (input.settings?.overlays?.length && !channel.settings.overlays?.length)
    await assertAllowed(channel.ownerId, { type: 'feature', feature: 'overlays' });
  const [updated] = await db
    .update(channels)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(channels.id, channel.id))
    .returning();
  return updated;
});

/** Deletes a channel, its sub-channels, their items, grants and files. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { channel } = await requireChannel((await params).id, 'manage');
  const ids = await descendants(channel.id);
  await db.delete(items).where(inArray(items.channelId, ids));
  await db.delete(grants).where(inArray(grants.channelId, ids));
  await db.delete(channels).where(inArray(channels.id, ids));
  await Promise.all(ids.map((id) => storage.removePrefix(fileKeyPrefix(id))));
  return { ok: true };
});

/** The channel id plus every descendant id. */
async function descendants(id: string): Promise<string[]> {
  const rows = await db.all<{ id: string }>(sql`
    WITH RECURSIVE tree(id) AS (
      SELECT ${id} UNION ALL SELECT c.id FROM channels c JOIN tree ON c.parent_id = tree.id
    ) SELECT id FROM tree`);
  return rows.map((r) => r.id);
}
