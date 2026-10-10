import { generateKeyBetween } from 'fractional-indexing';
import type { ChannelRow, ItemRow } from '@/lib/db';
import { newId } from '@/lib/crypto';
import { fail } from '@/lib/http';
import { storage } from '@/lib/storage';
import { fetchEmbedInfo } from '@/lib/embed';
import type { ChannelSettings, ItemInput } from '@/lib/types';

export const fileKeyPrefix = (channelId: string) => `c/${channelId}/`;

/** Rounds or drops coordinates according to the channel's submission privacy setting. */
export function applyPrecision(
  lat: number | null | undefined,
  lng: number | null | undefined,
  precision: NonNullable<ChannelSettings['submissions']>['locationPrecision'] = 'exact',
) {
  if (lat == null || lng == null || precision === 'none') return { lat: null, lng: null };
  if (precision === 'approximate') return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
  return { lat, lng };
}

/** Restricts what a submitter (not an editor) can set: always pending, no curation fields. */
export function sanitizeSubmission(input: ItemInput, channel: ChannelRow): ItemInput {
  const { lat, lng } = applyPrecision(input.lat, input.lng, channel.settings.submissions?.locationPrecision);
  const { contributor, is360 } = input.meta ?? {};
  return {
    kind: input.kind,
    url: input.url,
    thumbUrl: input.thumbUrl,
    audioUrl: input.audioUrl,
    fileKeys: input.fileKeys,
    title: input.title,
    caption: input.caption,
    takenAt: input.takenAt,
    lat,
    lng,
    status: 'pending',
    meta: { contributor, is360 },
  };
}

/** Verifies uploaded files belong to this channel and returns their real total size. */
export async function measureFiles(channelId: string, keys: string[] = []) {
  let bytes = 0;
  for (const key of keys) {
    if (!key.startsWith(fileKeyPrefix(channelId))) fail(400, 'File does not belong to this channel');
    const size = await storage.size(key);
    if (size == null) fail(400, 'Upload not found');
    bytes += size;
  }
  return bytes;
}

/** Turns validated input into rows ready to insert, positioned after `after`. */
export async function buildItems(channelId: string, inputs: ItemInput[], after: string | null) {
  const rows: (typeof import('@/lib/db').items.$inferInsert)[] = [];
  let prev = after;
  for (const input of inputs) {
    if (input.kind !== 'text' && !input.url) fail(400, 'Media items need a url');
    let { title, thumbUrl } = input;
    if (input.kind === 'embed' && input.url && !thumbUrl) {
      const info = await fetchEmbedInfo(input.url);
      thumbUrl = info.thumbUrl ?? null;
      title ||= info.title;
    }
    const position = input.position ?? generateKeyBetween(prev, null);
    prev = position;
    rows.push({
      ...input,
      id: newId(),
      channelId,
      position,
      title: title ?? '',
      thumbUrl,
      fileKeys: input.fileKeys ?? [],
      bytes: await measureFiles(channelId, input.fileKeys),
    });
  }
  return rows;
}

export const removedKeys = (before: ItemRow, after: string[] | undefined) =>
  after ? before.fileKeys.filter((k) => !after.includes(k)) : [];
