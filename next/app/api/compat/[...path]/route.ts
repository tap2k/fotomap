import { eq } from 'drizzle-orm';
import { db, channels } from '@/lib/db';
import { loadChannel } from '@/lib/channel';
import { absoluteUrl } from '@/lib/storage';
import { mimeFromName } from '@/lib/mime';

/**
 * Read-only adapter that answers the old Strapi `getChannel?uniqueID=` call with the old JSON
 * shape, so the existing video service keeps working. Published content of non-private channels only.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('uniqueID') ?? '';
  const [row] = await db.select().from(channels).where(eq(channels.slug, slug));
  if (!row || row.visibility === 'private') return Response.json({ error: 'Not found' }, { status: 404 });
  const c = await loadChannel(row);
  return Response.json({
    uniqueID: c.slug,
    name: c.title,
    description: c.description,
    interval: c.settings.interval ?? null,
    audiofile: c.settings.audioUrl ? { url: absoluteUrl(c.settings.audioUrl) } : null,
    picture: c.settings.coverUrl ? { url: absoluteUrl(c.settings.coverUrl) } : null,
    contents: c.items.map((i, order) => ({
      id: i.id,
      order,
      title: i.title,
      description: i.caption,
      lat: i.lat,
      long: i.lng,
      ext_url: i.kind === 'embed' ? i.url : null,
      mediafile: i.kind !== 'embed' && i.url ? { url: absoluteUrl(i.url), mime: mimeFromName(i.url) } : null,
      audiofile: i.audioUrl ? { url: absoluteUrl(i.audioUrl) } : null,
      is360: !!i.meta.is360,
      start_time: i.meta.start ?? null,
      duration: i.meta.duration ?? null,
      textalignment: i.meta.align ?? 'center',
      tags: i.tags.map((tag) => ({ tag })),
    })),
  });
}
