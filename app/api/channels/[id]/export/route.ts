import { route } from '@/lib/http';
import { requireChannel } from '@/lib/access';
import { loadChannel } from '@/lib/channel';
import { toCsv, toGeoJson } from '@/lib/export';
import { absoluteUrl } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };

/** ?format=json|csv|geojson. Editors export everything; others get published items only. */
export const GET = route<Ctx>(async (req, { params }) => {
  const format = new URL(req.url).searchParams.get('format') ?? 'json';
  const { channel: row, roles } = await requireChannel((await params).id, 'view');
  const channel = await loadChannel(row, { drafts: roles.some((r) => r === 'owner' || r === 'editor') });
  const name = `${row.slug}-${new Date().toISOString().slice(0, 10)}`;
  const [body, type, ext] =
    format === 'csv'
      ? [toCsv(channel, absoluteUrl), 'text/csv; charset=utf-8', 'csv']
      : format === 'geojson'
        ? [JSON.stringify(toGeoJson(channel, absoluteUrl)), 'application/geo+json', 'geojson']
        : [JSON.stringify(channel, null, 2), 'application/json', 'json'];
  return new Response(body, {
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}.${ext}"` },
  });
});
