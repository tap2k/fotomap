import { generateKeyBetween } from 'fractional-indexing';
import { newId } from '@/lib/crypto';
import { youtubeId } from '@/lib/embed';
import { mimeFromName } from '@/lib/mime';
import type { channels, grants, items, users } from '@/lib/db/schema';
import type { ChannelSettings, ItemMeta } from '@/lib/types';

// Pure transform from Strapi 4 tables (as rows) to Fotomap v2 rows. The script in
// scripts/migrate-strapi.ts loads the rows from Postgres and inserts the result.

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type StrapiSnapshot = Record<string, Row[]>;

export const STRAPI_TABLES = [
  'up_users', 'channels', 'contents', 'tags', 'overlays', 'tilesets', 'files', 'files_related_morphs',
  'channels_owner_links', 'channels_parent_links', 'channels_editors_links', 'channels_tileset_links',
  'contents_channel_links', 'contents_contributor_links', 'tags_contents_links', 'tags_channel_links', 'overlays_channel_links',
] as const;

// Leaflet colored-marker palette the old app used.
export const MARKER_COLORS: Record<string, string> = {
  black: '#3d3d3d', blue: '#2a81cb', gold: '#ffd326', green: '#2aad27', grey: '#7b7b7b',
  orange: '#cb8427', red: '#cb2b3e', violet: '#9c2bcb', yellow: '#cac428',
};

const PLAN_RANK = ['free', 'starter', 'pro', 'enterprise'] as const;

export type Migrated = {
  users: (typeof users.$inferInsert)[];
  channels: (typeof channels.$inferInsert)[];
  items: (typeof items.$inferInsert)[];
  grants: (typeof grants.$inferInsert)[];
  warnings: string[];
};

export function transformStrapi(s: StrapiSnapshot, { mediaBase = '' }: { mediaBase?: string } = {}): Migrated {
  const warnings: string[] = [];
  const t = (name: string) => s[name] ?? [];
  const abs = (url?: string | null) => (url ? (url.startsWith('/') ? mediaBase.replace(/\/$/, '') + url : url) : null);
  const date = (v: unknown) => (v ? new Date(v as string) : undefined);

  // --- users: one per email (old data has local + supabase duplicates)
  const userId = new Map<number, string>();
  const byEmail = new Map<string, Migrated['users'][number]>();
  for (const u of [...t('up_users')].sort((a, b) => a.id - b.id)) {
    if (!u.email) continue;
    const email = String(u.email).trim().toLowerCase();
    let user = byEmail.get(email);
    if (!user) {
      user = { id: newId(), email, name: u.username ?? null, plan: 'free', isAdmin: false, createdAt: date(u.created_at) };
      byEmail.set(email, user);
    }
    const plan = PLAN_RANK.includes(u.plan) ? u.plan : 'free';
    if (PLAN_RANK.indexOf(plan) > PLAN_RANK.indexOf(user.plan as (typeof PLAN_RANK)[number])) user.plan = plan;
    if (u.id === 1) user.isAdmin = true; // the old code's superuser
    userId.set(u.id, user.id);
  }
  const fallbackOwner = userId.get(1) ?? [...byEmail.values()][0]?.id;

  // --- files: (type, id, field) -> file
  const files = new Map(t('files').map((f) => [f.id, f]));
  const fileFor = new Map<string, Row>();
  for (const m of t('files_related_morphs')) {
    const f = files.get(m.file_id);
    if (f) fileFor.set(`${m.related_type}:${m.related_id}:${m.field}`, f);
  }
  const file = (type: string, id: number, field: string) => fileFor.get(`api::${type}.${type}:${id}:${field}`);
  const kb = (f?: Row) => (f?.size ? Math.round(Number(f.size) * 1024) : 0);
  const thumbOf = (f?: Row) => {
    const formats = typeof f?.formats === 'string' ? JSON.parse(f.formats) : f?.formats;
    return abs(formats?.small?.url ?? formats?.thumbnail?.url ?? formats?.medium?.url ?? null);
  };

  // --- links
  const one = (table: string, from: string, to: string) => new Map(t(table).map((r) => [r[from], r[to]]));
  const many = (table: string, from: string, to: string) => {
    const m = new Map<number, Row[]>();
    for (const r of t(table)) m.set(r[from], [...(m.get(r[from]) ?? []), { ...r, target: r[to] }]);
    return m;
  };
  const ownerOf = one('channels_owner_links', 'channel_id', 'user_id');
  const parentOf = one('channels_parent_links', 'channel_id', 'inv_channel_id');
  const tilesetOf = one('channels_tileset_links', 'channel_id', 'tileset_id');
  const editorsOf = many('channels_editors_links', 'channel_id', 'user_id');
  const channelOfContent = one('contents_channel_links', 'content_id', 'channel_id');
  const contentOrder = one('contents_channel_links', 'content_id', 'content_order');
  const contributorOf = one('contents_contributor_links', 'content_id', 'user_id');
  const tagsOfContent = many('tags_contents_links', 'content_id', 'tag_id');
  const channelOfTag = one('tags_channel_links', 'tag_id', 'channel_id');
  const channelOfOverlay = one('overlays_channel_links', 'overlay_id', 'channel_id');
  const tags = new Map(t('tags').map((r) => [r.id, r]));
  const tilesets = new Map(t('tilesets').map((r) => [r.id, r]));
  const usernames = new Map(t('up_users').map((u) => [u.id, u.username]));

  // --- channels
  const channelRows = new Map(t('channels').map((c) => [c.id, c]));
  const channelId = new Map(t('channels').map((c) => [c.id, newId()]));
  const rootOf = (id: number, seen = new Set<number>()): number => {
    const p = parentOf.get(id);
    return p && channelRows.has(p) && !seen.has(p) ? rootOf(p, seen.add(id)) : id;
  };
  const treeOwner = (id: number) => {
    const explicit = ownerOf.get(rootOf(id)) ?? ownerOf.get(id);
    return (explicit && userId.get(explicit)) || fallbackOwner;
  };

  const out: Migrated = { users: [...byEmail.values()], channels: [], items: [], grants: [], warnings };
  const grantKeys = new Set<string>();
  const grant = (channel: string, role: 'owner' | 'editor', user?: string) => {
    if (!user || grantKeys.has(`${channel}:${user}`)) return;
    grantKeys.add(`${channel}:${user}`);
    out.grants.push({ id: newId(), channelId: channel, role, userId: user });
  };

  // Children are ordered by the old `order` column; positions are fractional keys.
  const siblings = new Map<number | null, Row[]>();
  for (const c of t('channels')) {
    const p = parentOf.get(c.id) ?? null;
    siblings.set(p, [...(siblings.get(p) ?? []), c]);
  }
  const channelPosition = new Map<number, string>();
  for (const list of siblings.values()) {
    let prev: string | null = null;
    for (const c of list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)) channelPosition.set(c.id, (prev = generateKeyBetween(prev, null)));
  }

  const tagColorsOf = new Map<number, Record<string, string>>();
  for (const tag of tags.values()) {
    const ch = channelOfTag.get(tag.id);
    if (ch && tag.markercolor && MARKER_COLORS[tag.markercolor]) tagColorsOf.set(ch, { ...tagColorsOf.get(ch), [tag.tag]: MARKER_COLORS[tag.markercolor] });
  }
  const overlaysOf = new Map<number, NonNullable<ChannelSettings['overlays']>>();
  for (const o of t('overlays')) {
    const ch = channelOfOverlay.get(o.id);
    const img = abs(file('overlay', o.id, 'image')?.url);
    if (!ch || !img) continue;
    const c = (lat: number, lng: number) => ({ lat: Number(lat), lng: Number(lng) });
    overlaysOf.set(ch, [...(overlaysOf.get(ch) ?? []), { url: img, opacity: 0.8, corners: [c(o.tl_lat, o.tl_long), c(o.tr_lat, o.tr_long), c(o.br_lat, o.br_long), c(o.bl_lat, o.bl_long)] }]);
  }

  for (const c of t('channels')) {
    const id = channelId.get(c.id)!;
    const parent = parentOf.get(c.id);
    const ownerId = treeOwner(c.id);
    if (!ownerId) {
      warnings.push(`Channel ${c.unique_id} has no owner and there are no users; skipped`);
      continue;
    }
    const tileset = tilesets.get(tilesetOf.get(c.id));
    const picture = file('channel', c.id, 'picture');
    const music = file('channel', c.id, 'audiofile');
    const settings: ChannelSettings = {
      interval: c.interval > 0 ? Math.min(120, c.interval) : undefined,
      markerColor: MARKER_COLORS[c.markercolor],
      tagColors: tagColorsOf.get(c.id),
      overlays: overlaysOf.get(c.id),
      coverUrl: abs(picture?.url) ?? undefined,
      audioUrl: abs(music?.url) ?? undefined,
      showTitle: c.showtitle ?? undefined,
      mapStyle: tileset?.urlformatstring || undefined,
      mapAttribution: tileset?.attribution || undefined,
    };
    out.channels.push({
      id,
      slug: c.unique_id, // keeps old public URLs working
      parentId: parent && channelId.get(parent) ? channelId.get(parent) : null,
      ownerId,
      title: c.name || 'Untitled',
      description: c.description ?? '',
      visibility: c.public ? 'public' : 'unlisted',
      lat: c.lat ?? null,
      lng: c.long ?? null,
      zoom: c.zoom != null ? Math.max(0, c.zoom - 1) : null, // Leaflet zoom = MapLibre zoom + 1 (256 vs 512 px tiles)
      position: channelPosition.get(c.id) ?? 'a0',
      settings: JSON.parse(JSON.stringify(settings)), // drop undefined
      createdAt: date(c.created_at),
      updatedAt: date(c.updated_at),
    });
    const explicitOwner = userId.get(ownerOf.get(c.id));
    if (!parent) grant(id, 'owner', ownerId);
    else if (explicitOwner && explicitOwner !== ownerId) grant(id, 'owner', explicitOwner);
    for (const e of editorsOf.get(c.id) ?? []) grant(id, 'editor', userId.get(e.target));
    if (c.allowsubmissions) warnings.push(`Channel ${c.unique_id} accepted submissions: create a new submission link (old private links no longer work)`);
  }

  // --- items
  const byChannel = new Map<number, Row[]>();
  for (const ct of t('contents')) {
    const ch = channelOfContent.get(ct.id);
    if (!ch || !channelId.has(ch)) {
      warnings.push(`Content ${ct.id} has no channel; skipped`);
      continue;
    }
    byChannel.set(ch, [...(byChannel.get(ch) ?? []), ct]);
  }
  for (const [ch, list] of byChannel) {
    let prev: string | null = null;
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (contentOrder.get(a.id) ?? 0) - (contentOrder.get(b.id) ?? 0) || a.id - b.id);
    for (const ct of list) {
      const media = file('content', ct.id, 'mediafile');
      const audio = file('content', ct.id, 'audiofile');
      const mime: string = media?.mime || (media ? mimeFromName(media.url) : '');
      const kind = media
        ? mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'image'
        : ct.ext_url ? 'embed' : audio ? 'audio' : 'text';
      const url = media ? abs(media.url) : kind === 'embed' ? ct.ext_url : kind === 'audio' ? abs(audio?.url) : null;
      const yt = kind === 'embed' && ct.ext_url ? youtubeId(ct.ext_url) : null;
      // The old `name` field held the narrator/contributor when a title was also set.
      const contributor = usernames.get(contributorOf.get(ct.id)) ?? (ct.title && ct.name ? String(ct.name) : undefined);
      const meta: ItemMeta = {
        is360: ct.is_360 || ct.is360 || String(ct.mapping ?? '').startsWith('equirect') || undefined,
        start: ct.start_time > 0 ? ct.start_time : undefined,
        duration: ct.duration > 0 ? ct.duration : undefined,
        align: ['top', 'center', 'bottom'].includes(ct.textalignment) ? ct.textalignment : undefined,
        contributor: contributor ? { name: contributor } : undefined,
      };
      out.items.push({
        id: newId(),
        channelId: channelId.get(ch)!,
        position: (prev = generateKeyBetween(prev, null)),
        kind,
        status: ct.published_at ? 'published' : 'draft',
        url,
        thumbUrl: kind === 'image' || kind === 'video' ? thumbOf(media) : yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null,
        audioUrl: kind !== 'audio' && audio ? abs(audio.url) : null,
        fileKeys: [], // files stay where Strapi stored them
        bytes: kb(media) + kb(audio),
        title: ct.title || ct.name || '',
        caption: ct.description ?? '',
        tags: [...new Set((tagsOfContent.get(ct.id) ?? []).map((l) => tags.get(l.target)?.tag).filter(Boolean))] as string[],
        lat: ct.lat ?? null,
        lng: ct.long ?? null,
        meta: JSON.parse(JSON.stringify(meta)),
        createdAt: date(ct.created_at),
        updatedAt: date(ct.updated_at),
      });
    }
  }
  return out;
}

/**
 * Builds a table snapshot from the public `getChannel?uniqueID=` JSON of the old API, so a
 * project can be imported without database access (no users or editors; one owner is given).
 */
export function apiToSnapshot(channels: Row[], ownerEmail: string): StrapiSnapshot {
  const snap: StrapiSnapshot = Object.fromEntries(STRAPI_TABLES.map((t) => [t, []]));
  const OWNER = 1_000_000; // not 1: id 1 means superuser in the old data
  snap.up_users.push({ id: OWNER, email: ownerEmail, username: ownerEmail.split('@')[0], plan: 'free' });
  let fileId = 0;
  const file = (f: Row | null | undefined, type: string, related: number, field: string) => {
    if (!f?.url) return;
    snap.files.push({ id: ++fileId, url: f.url, size: f.size, mime: f.mime, formats: f.formats });
    snap.files_related_morphs.push({ file_id: fileId, related_id: related, related_type: `api::${type}.${type}`, field });
  };
  const tagIds = new Map<string, number>();
  for (const c of channels) {
    snap.channels.push({
      id: c.id, unique_id: c.uniqueID, name: c.name, public: c.public, lat: c.lat, long: c.long, zoom: c.zoom, interval: c.interval,
      markercolor: c.markercolor, showtitle: c.showtitle, description: c.description, order: c.order, allowsubmissions: c.allowsubmissions,
      created_at: c.createdAt, updated_at: c.updatedAt,
    });
    if (c.parentId) snap.channels_parent_links.push({ channel_id: c.id, inv_channel_id: c.parentId });
    else snap.channels_owner_links.push({ channel_id: c.id, user_id: OWNER });
    if (c.tileset?.urlformatstring) {
      if (!snap.tilesets.some((t) => t.id === c.tileset.id)) snap.tilesets.push(c.tileset);
      snap.channels_tileset_links.push({ channel_id: c.id, tileset_id: c.tileset.id });
    }
    file(c.picture, 'channel', c.id, 'picture');
    file(c.audiofile, 'channel', c.id, 'audiofile');
    for (const t of c.tags ?? []) {
      if (!tagIds.has(`${c.id}:${t.tag}`)) {
        tagIds.set(`${c.id}:${t.tag}`, t.id);
        snap.tags.push({ id: t.id, tag: t.tag, markercolor: t.markercolor });
        snap.tags_channel_links.push({ tag_id: t.id, channel_id: c.id });
      }
    }
    for (const o of c.overlays ?? []) {
      snap.overlays.push(o);
      snap.overlays_channel_links.push({ overlay_id: o.id, channel_id: c.id });
      file(o.image, 'overlay', o.id, 'image');
    }
    for (const ct of c.contents ?? []) {
      snap.contents.push({
        id: ct.id, order: ct.order, title: ct.title, name: ct.name, description: ct.description, lat: ct.lat, long: ct.long,
        ext_url: ct.ext_url, is_360: ct.is360, mapping: ct.mapping, textalignment: ct.textalignment, start_time: ct.start_time,
        duration: ct.duration, published_at: ct.publishedAt, created_at: ct.createdAt, updated_at: ct.updatedAt,
      });
      snap.contents_channel_links.push({ content_id: ct.id, channel_id: c.id });
      for (const t of ct.tags ?? []) snap.tags_contents_links.push({ tag_id: tagIds.get(`${c.id}:${t.tag}`) ?? t.id, content_id: ct.id });
      file(ct.mediafile, 'content', ct.id, 'mediafile');
      file(ct.audiofile, 'content', ct.id, 'audiofile');
    }
  }
  return snap;
}
