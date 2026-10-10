import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import { db, channels, items, type ChannelRow, type ItemRow } from '@/lib/db';
import type { Channel, Item } from '@/lib/types';

export function toItem(row: ItemRow, { withNotes = false } = {}): Item {
  const { note, ...meta } = row.meta;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    position: row.position,
    url: row.url,
    thumbUrl: row.thumbUrl,
    audioUrl: row.audioUrl,
    title: row.title,
    caption: row.caption,
    tags: row.tags,
    lat: row.lat,
    lng: row.lng,
    takenAt: row.takenAt?.toISOString() ?? null,
    meta: withNotes && note ? { ...meta, note } : meta,
  };
}

/**
 * Builds the one Channel shape used everywhere. Public callers get published items only;
 * editors (`drafts: true`) get every item plus private curator notes.
 */
export async function loadChannel(row: ChannelRow, { drafts = false } = {}): Promise<Channel> {
  const [itemRows, childRows, parentRow] = await Promise.all([
    db
      .select()
      .from(items)
      .where(drafts ? eq(items.channelId, row.id) : and(eq(items.channelId, row.id), eq(items.status, 'published')))
      .orderBy(asc(items.position), asc(items.createdAt)),
    db
      .select()
      .from(channels)
      .where(
        drafts
          ? eq(channels.parentId, row.id)
          : and(eq(channels.parentId, row.id), inArray(channels.visibility, ['unlisted', 'public'])),
      )
      .orderBy(asc(channels.position), asc(channels.createdAt)),
    row.parentId ? db.select().from(channels).where(eq(channels.id, row.parentId)) : Promise.resolve([]),
  ]);
  const parent = parentRow[0];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    lat: row.lat,
    lng: row.lng,
    zoom: row.zoom,
    settings: row.settings,
    parent: parent && (drafts || parent.visibility !== 'private') ? { slug: parent.slug, title: parent.title } : null,
    children: childRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      lat: c.lat,
      lng: c.lng,
      coverUrl: c.settings.coverUrl ?? null,
    })),
    items: itemRows.map((r) => toItem(r, { withNotes: drafts })),
  };
}

/** Position key after the last item in a channel (fractional indexing: reorders touch one row). */
export async function nextPosition(channelId: string) {
  const [last] = await db
    .select({ position: items.position })
    .from(items)
    .where(eq(items.channelId, channelId))
    .orderBy(desc(items.position))
    .limit(1);
  return generateKeyBetween(last?.position ?? null, null);
}

export const touch = (channelId: string) =>
  db.update(channels).set({ updatedAt: new Date() }).where(eq(channels.id, channelId));
