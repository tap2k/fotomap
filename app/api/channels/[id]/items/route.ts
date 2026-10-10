import { z } from 'zod';
import { db, items } from '@/lib/db';
import { route } from '@/lib/http';
import { requireChannel } from '@/lib/access';
import { assertAllowed } from '@/lib/plans';
import { nextPosition, toItem, touch } from '@/lib/channel';
import { buildItems, sanitizeSubmission } from '@/lib/items';
import { itemInputSchema } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

/** Adds items: uploads, links, text cards, imports, and public submissions (which land as pending). */
export const POST = route<Ctx>(async (req, { params }) => {
  const { channel, roles } = await requireChannel((await params).id, 'submit');
  const body = z.object({ items: z.array(itemInputSchema).min(1).max(500), submission: z.boolean().optional() }).parse(await req.json());
  // The contributor page always submits for review, even when an editor uses it.
  const editor = !body.submission && roles.some((r) => r === 'owner' || r === 'editor');
  const inputs = editor ? body.items : body.items.map((i) => sanitizeSubmission(i, channel));
  const rows = await buildItems(channel.id, inputs, await nextPosition(channel.id));
  await assertAllowed(channel.ownerId, { type: 'upload', bytes: rows.reduce((n, r) => n + (r.bytes ?? 0), 0) });
  const inserted = await db.insert(items).values(rows).returning();
  await touch(channel.id);
  return editor ? inserted.map((r) => toItem(r, { withNotes: true })) : { ok: true, count: inserted.length };
});
