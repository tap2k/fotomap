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
  if (channel.settings.submissions?.consent && contributor?.consent !== true) fail(400, 'Consent is required');
  return {
    kind: input.kind,
    url: input.url,
    thumbUrl: input.thumbUrl,
    audioUrl: input.audioUrl,
    title: input.title,
    caption: input.caption,
    takenAt: input.takenAt,
    lat,
    lng,
    status: 'pending',
    meta: { contributor, is360 },
  };
}

type Urls = { url?: string | null; thumbUrl?: string | null; audioUrl?: string | null };

/** Stored files an item uses, derived from its URLs. Only this channel's files count; anything else is an external link. */
export function keysOf(channelId: string, urls: Urls): string[] {
  const base = storage.publicUrl('');
  const mine = storage.publicUrl(fileKeyPrefix(channelId));
  return [urls.url, urls.thumbUrl, urls.audioUrl].flatMap((u) => (u?.startsWith(mine) ? [u.slice(base.length)] : []));
}

/** The item's stored files and their real total size (never trusts the client's numbers). */
export async function measureFiles(channelId: string, urls: Urls) {
  const fileKeys = keysOf(channelId, urls);
  let bytes = 0;
  for (const key of fileKeys) {
    const size = await storage.size(key);
    if (size == null) fail(400, 'Upload not found');
    bytes += size;
  }
  return { fileKeys, bytes };
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
      ...(await measureFiles(channelId, { ...input, thumbUrl })),
    });
  }
  return rows;
}

export const removedKeys = (before: ItemRow, after: string[] | undefined) =>
  after ? before.fileKeys.filter((k) => !after.includes(k)) : [];

export const touchesFiles = (patch: Urls) => 'url' in patch || 'thumbUrl' in patch || 'audioUrl' in patch;
