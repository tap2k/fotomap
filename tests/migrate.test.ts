import { describe, expect, it } from 'vitest';
import snapshot from './fixtures/strapi-snapshot.json';
import { transformStrapi } from '@/lib/migrate-strapi';

// The fixture was produced by running the real Strapi 4.14 backend against Postgres and
// seeding it through Strapi's own services, so the table shapes are genuine.
const out = transformStrapi(snapshot as never, { mediaBase: 'https://old.example.org/' });
const channel = (slug: string) => out.channels.find((c) => c.slug === slug)!;
const item = (title: string) => out.items.find((i) => i.title === title)!;

describe('Strapi migration', () => {
  it('merges duplicate accounts by email and keeps the superuser and best plan', () => {
    expect(out.users.map((u) => u.email).sort()).toEqual(['admin@example.org', 'ana@example.org', 'ed@example.org']);
    expect(out.users.find((u) => u.email === 'admin@example.org')!.isAdmin).toBe(true);
    expect(out.users.find((u) => u.email === 'ana@example.org')!.plan).toBe('starter');
  });

  it('keeps old URLs and the channel tree', () => {
    const root = channel('oldRoot1');
    expect(root.visibility).toBe('public');
    expect(channel('oldChild1').visibility).toBe('unlisted');
    expect(channel('oldChild1').parentId).toBe(root.id);
    expect(channel('oldChild2').position! < channel('oldChild1').position!).toBe(true); // order 0 before 1
    const ana = out.users.find((u) => u.email === 'ana@example.org')!.id;
    expect(out.channels.every((c) => c.ownerId === ana)).toBe(true);
  });

  it('moves styling into settings', () => {
    const s = channel('oldRoot1').settings!;
    expect(s.interval).toBe(7);
    expect(s.markerColor).toBe('#2aad27');
    expect(s.tagColors).toEqual({ water: '#2a81cb', food: '#cb2b3e' });
    expect(s.mapStyle).toBe('https://tiles.example.org/{z}/{x}/{y}.png');
    expect(s.coverUrl).toMatch(/^https:\/\/old\.example\.org\/uploads\//);
    expect(s.overlays?.[0].corners[0]).toEqual({ lat: 51.6, lng: -0.2 });
  });

  it('converts content to items in order, with kinds, tags, media and status', () => {
    const root = channel('oldRoot1').id;
    const titles = out.items.filter((i) => i.channelId === root).sort((a, b) => (a.position < b.position ? -1 : 1)).map((i) => i.title);
    expect(titles).toEqual(['Photo one', 'Photo two', 'A video link', 'Draft note']);
    expect(item('Photo one')).toMatchObject({ kind: 'image', status: 'published', lat: 51.52, tags: ['water'], meta: { is360: true } });
    expect(item('Photo one').audioUrl).toMatch(/\/uploads\//);
    expect(item('Photo one').thumbUrl).toMatch(/small_/);
    expect(item('Photo two')).toMatchObject({ tags: ['water', 'food'], meta: { contributor: { name: 'ed' } } });
    expect(item('Photo two').bytes).toBeGreaterThan(100_000);
    expect(item('A video link')).toMatchObject({ kind: 'embed', meta: { start: 12, duration: 30 } });
    expect(item('A video link').thumbUrl).toContain('i.ytimg.com');
    expect(item('Draft note')).toMatchObject({ kind: 'text', status: 'draft' });
  });

  it('grants the owner and editors, and warns about submission links', () => {
    const root = channel('oldRoot1').id;
    const roles = out.grants.filter((g) => g.channelId === root).map((g) => g.role).sort();
    expect(roles).toEqual(['editor', 'owner']);
    expect(out.warnings.some((w) => w.includes('submission link'))).toBe(true);
  });
});
