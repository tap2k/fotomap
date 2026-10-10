import { eq } from 'drizzle-orm';
import { db, channels, grants } from '@/lib/db';
import { route } from '@/lib/http';
import { requireChannel, requireUser, getActor } from '@/lib/access';
import { assertAllowed } from '@/lib/plans';
import { newId } from '@/lib/crypto';
import { channelInputSchema } from '@/lib/types';

/** Create a channel. Top-level: any signed-in user. Sub-channel: anyone who can edit the parent. */
export const POST = route(async (req) => {
  const input = channelInputSchema.parse(await req.json());
  const actor = await getActor();
  let ownerId: string;
  if (input.parentId) {
    const { channel: parent } = await requireChannel(input.parentId, 'edit', actor);
    input.parentId = parent.id;
    ownerId = parent.ownerId; // storage counts against the tree's owner
  } else {
    ownerId = (await requireUser()).id;
    await assertAllowed(ownerId, { type: 'channel' });
  }
  const [channel] = await db
    .insert(channels)
    .values({ ...input, domain: null, id: newId(), slug: newId(8), ownerId, settings: input.settings ?? {} })
    .returning();
  if (!input.parentId) await db.insert(grants).values({ id: newId(), channelId: channel.id, role: 'owner', userId: ownerId });
  return channel;
});

/** Channels the signed-in user holds a grant on. */
export const GET = route(async () => {
  const user = await requireUser();
  return db
    .select({ id: channels.id, slug: channels.slug, title: channels.title, role: grants.role })
    .from(grants)
    .innerJoin(channels, eq(channels.id, grants.channelId))
    .where(eq(grants.userId, user.id));
});
