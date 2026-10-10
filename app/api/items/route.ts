import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db, items, type ItemRow } from '@/lib/db';
import { fail, route } from '@/lib/http';
import { getActor, requireChannel } from '@/lib/access';
import { toItem, touch } from '@/lib/channel';
import { measureFiles, removedKeys, touchesFiles } from '@/lib/items';
import { storage } from '@/lib/storage';
import { assertAllowed } from '@/lib/plans';
import { itemPatchSchema } from '@/lib/types';

/** Loads items and checks the actor can edit every channel they belong to. */
async function editableItems(ids: string[]) {
  const rows: ItemRow[] = await db.select().from(items).where(inArray(items.id, ids));
  if (rows.length !== new Set(ids).size) fail(404, 'Item not found');
  const actor = await getActor();
  const owners = new Map<string, string>(); // channelId -> ownerId, for quota checks
  for (const channelId of new Set(rows.map((r) => r.channelId)))
    owners.set(channelId, (await requireChannel(channelId, 'edit', actor)).channel.ownerId);
  return { rows, owners };
}

/** Batch update: edits, reorders (position), approvals (status), tag renames. */
export const PATCH = route(async (req) => {
  const { items: patches } = z.object({ items: z.array(itemPatchSchema).min(1).max(1000) }).parse(await req.json());
  const found = await editableItems(patches.map((p) => p.id));
  const rows = new Map(found.rows.map((r) => [r.id, r]));
  const updated = [];
  for (const { id, ...patch } of patches) {
    const before = rows.get(id)!;
    const extra = touchesFiles(patch) ? await measureFiles(before.channelId, { ...before, ...patch }) : undefined;
    if (extra && extra.bytes > before.bytes)
      await assertAllowed(found.owners.get(before.channelId)!, { type: 'upload', bytes: extra.bytes - before.bytes });
    const [row] = await db
      .update(items)
      .set({ ...patch, ...extra, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    await storage.remove(removedKeys(before, extra?.fileKeys));
    updated.push(toItem(row, { withNotes: true }));
  }
  await Promise.all([...new Set([...rows.values()].map((r) => r.channelId))].map(touch));
  return updated;
});

export const DELETE = route(async (req) => {
  const { ids } = z.object({ ids: z.array(z.string()).min(1).max(1000) }).parse(await req.json());
  const { rows } = await editableItems(ids);
  await db.delete(items).where(inArray(items.id, ids));
  await storage.remove(rows.flatMap((r) => r.fileKeys));
  await Promise.all([...new Set(rows.map((r) => r.channelId))].map(touch));
  return { ok: true };
});
