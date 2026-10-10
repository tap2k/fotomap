import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, channels, grants } from '@/lib/db';

export type ChannelCard = { id: string; slug: string; title: string; cover: string | null; count: number; role?: string };

// First published thumbnail as a fallback cover, plus the item count.
// Columns are written out in full: drizzle renders ${channels.id} unqualified inside subqueries.
const cover = sql<string | null>`coalesce(json_extract("channels"."settings", '$.coverUrl'),
  (SELECT coalesce(i.thumb_url, CASE WHEN i.kind = 'image' THEN i.url END) FROM items i
   WHERE i.channel_id = "channels"."id" AND i.status = 'published' AND (i.thumb_url IS NOT NULL OR i.kind = 'image')
   ORDER BY i.position LIMIT 1))`;
const count = sql<number>`(SELECT count(*) FROM items i WHERE i.channel_id = "channels"."id" AND i.status = 'published')`;

export const publicChannels = (limit = 24): Promise<ChannelCard[]> =>
  db
    .select({ id: channels.id, slug: channels.slug, title: channels.title, cover, count })
    .from(channels)
    .where(and(eq(channels.visibility, 'public'), isNull(channels.parentId)))
    .orderBy(desc(channels.updatedAt))
    .limit(limit);

export const myChannels = (userId: string): Promise<ChannelCard[]> =>
  db
    .select({ id: channels.id, slug: channels.slug, title: channels.title, cover, count, role: grants.role })
    .from(grants)
    .innerJoin(channels, eq(channels.id, grants.channelId))
    .where(eq(grants.userId, userId))
    .orderBy(desc(channels.updatedAt));
