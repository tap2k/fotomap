import { describe, expect, it } from 'vitest';
import { permits } from '@/lib/access';
import { checkLimit, PLANS } from '@/lib/plans';
import { applyPrecision, sanitizeSubmission } from '@/lib/items';
import { toCsv, toGeoJson } from '@/lib/export';
import { embedSrc, youtubeId, vimeoId } from '@/lib/embed';
import { itemInputSchema, channelSettingsSchema, type Channel } from '@/lib/types';
import type { ChannelRow } from '@/lib/db';

describe('permits', () => {
  it('lets anyone view unlisted and public channels', () => {
    expect(permits([], 'unlisted', 'view')).toBe(true);
    expect(permits([], 'public', 'view')).toBe(true);
    expect(permits([], 'private', 'view')).toBe(false);
  });
  it('maps roles to actions', () => {
    expect(permits(['viewer'], 'private', 'view')).toBe(true);
    expect(permits(['viewer'], 'private', 'edit')).toBe(false);
    expect(permits(['submitter'], 'private', 'submit')).toBe(true);
    expect(permits(['submitter'], 'private', 'view')).toBe(false);
    expect(permits(['editor'], 'private', 'edit')).toBe(true);
    expect(permits(['editor'], 'private', 'manage')).toBe(false);
    expect(permits(['owner'], 'private', 'manage')).toBe(true);
  });
  it('nobody submits without a grant, even on public channels', () => {
    expect(permits([], 'public', 'submit')).toBe(false);
  });
});

describe('checkLimit', () => {
  const free = PLANS.free;
  it('blocks channels over the limit', () => {
    expect(checkLimit(free, { storage: 0, channels: 4 }, { type: 'channel' })).toBeNull();
    expect(checkLimit(free, { storage: 0, channels: 5 }, { type: 'channel' })).toMatch(/5 channels/);
  });
  it('blocks large files and full storage', () => {
    expect(checkLimit(free, { storage: 0, channels: 0 }, { type: 'upload', bytes: 21 * 1024 * 1024 })).toMatch(/20 MB/);
    expect(checkLimit(free, { storage: 249 * 1024 * 1024, channels: 0 }, { type: 'upload', bytes: 2 * 1024 * 1024 })).toMatch(/Storage/);
    expect(checkLimit(free, { storage: 0, channels: 0 }, { type: 'upload', bytes: 1024 })).toBeNull();
  });
  it('gates features by plan', () => {
    expect(checkLimit(free, { storage: 0, channels: 0 }, { type: 'feature', feature: 'overlays' })).not.toBeNull();
    expect(checkLimit(PLANS.pro, { storage: 0, channels: 0 }, { type: 'feature', feature: 'overlays' })).toBeNull();
  });
  it('treats unlimited plans as unlimited', () => {
    expect(checkLimit(PLANS.enterprise, { storage: 1e15, channels: 1e6 }, { type: 'channel' })).toBeNull();
  });
});

describe('submissions', () => {
  const channel = (settings: ChannelRow['settings']) => ({ id: 'c1', settings }) as ChannelRow;
  it('rounds or drops coordinates', () => {
    expect(applyPrecision(51.507351, -0.127758, 'exact')).toEqual({ lat: 51.507351, lng: -0.127758 });
    expect(applyPrecision(51.507351, -0.127758, 'approximate')).toEqual({ lat: 51.51, lng: -0.13 });
    expect(applyPrecision(51.5, -0.1, 'none')).toEqual({ lat: null, lng: null });
    expect(applyPrecision(null, 3, 'exact')).toEqual({ lat: null, lng: null });
  });
  it('forces pending and strips curator fields', () => {
    const out = sanitizeSubmission(
      { kind: 'image', url: 'https://x/a.jpg', status: 'published', tags: ['x'], position: 'a0', meta: { note: 'n', camera: { zoom: 3 }, contributor: { name: 'Ana' } }, lat: 1.23456, lng: 2.34567 },
      channel({ submissions: { locationPrecision: 'approximate' } }),
    );
    expect(out.status).toBe('pending');
    expect(out.tags).toBeUndefined();
    expect(out.position).toBeUndefined();
    expect(out.meta).toEqual({ contributor: { name: 'Ana' }, is360: undefined });
    expect([out.lat, out.lng]).toEqual([1.23, 2.35]);
  });
  it('requires consent when the channel asks for it', () => {
    const c = channel({ submissions: { consent: 'I agree' } });
    expect(() => sanitizeSubmission({ kind: 'text', caption: 'hi' }, c)).toThrow(/Consent/);
    expect(() => sanitizeSubmission({ kind: 'text', caption: 'hi', meta: { contributor: { consent: true } } }, c)).not.toThrow();
  });
});

describe('input validation', () => {
  it('rejects unsafe URLs', () => {
    expect(itemInputSchema.safeParse({ kind: 'embed', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(itemInputSchema.safeParse({ kind: 'embed', url: 'data:text/html,x' }).success).toBe(false);
    expect(itemInputSchema.safeParse({ kind: 'image', url: '/api/files/c/x/y.webp' }).success).toBe(true);
    expect(itemInputSchema.safeParse({ kind: 'embed', url: 'https://youtu.be/dQw4w9WgXcQ' }).success).toBe(true);
  });
  it('rejects unknown settings keys', () => {
    expect(channelSettingsSchema.safeParse({ theme: 'dark' }).success).toBe(true);
    expect(channelSettingsSchema.safeParse({ evil: 1 }).success).toBe(false);
  });
});

describe('export', () => {
  const channel: Channel = {
    id: 'c', slug: 's', title: 'T', description: '', visibility: 'unlisted', lat: null, lng: null, zoom: null, domain: null, settings: {}, parent: null, children: [],
    items: [
      { id: 'i1', kind: 'image', status: 'published', position: 'a0', url: '/api/files/c/c/a.webp', thumbUrl: null, audioUrl: null, title: '=HYPERLINK("x")', caption: 'line, "quoted"\nnext', tags: ['a', 'b'], lat: 1, lng: 2, takenAt: null, meta: {} },
      { id: 'i2', kind: 'text', status: 'draft', position: 'a1', url: null, thumbUrl: null, audioUrl: null, title: 'No place', caption: '', tags: [], lat: null, lng: null, takenAt: null, meta: {} },
    ],
  };
  it('writes safe CSV', () => {
    const csv = toCsv(channel, (u) => (u ? 'https://app' + u : u));
    const [header, row] = csv.split('\r\n');
    expect(header.startsWith('id,kind,status,title')).toBe(true);
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain('"line, ""quoted""\nnext"');
    expect(row).toContain('a;b');
    expect(row).toContain('https://app/api/files/c/c/a.webp');
  });
  it('only exports located items to GeoJSON', () => {
    const gj = toGeoJson(channel);
    expect(gj.features).toHaveLength(1);
    expect(gj.features[0].geometry.coordinates).toEqual([2, 1]);
  });
});

describe('embeds', () => {
  it('recognises YouTube and Vimeo links', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(vimeoId('https://vimeo.com/76979871')).toBe('76979871');
    expect(embedSrc('https://example.com/page')).toBeNull();
    expect(embedSrc('https://youtu.be/dQw4w9WgXcQ', { start: 30 })).toContain('start=30');
  });
});
