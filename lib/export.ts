import type { Channel } from '@/lib/types';

const CSV_COLUMNS = ['id', 'kind', 'status', 'title', 'caption', 'tags', 'lat', 'lng', 'takenAt', 'url', 'audioUrl', 'contributor', 'note'] as const;

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Quote everything that needs it; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** One row per item; tags joined with ';'. Opens in Excel, NVivo, Atlas.ti, R. */
export function toCsv(channel: Channel, abs: (u: string | null) => string | null = (u) => u): string {
  const rows = channel.items.map((i) => [
    i.id, i.kind, i.status, i.title, i.caption, i.tags.join(';'), i.lat, i.lng, i.takenAt,
    abs(i.url), abs(i.audioUrl), i.meta.contributor?.name, i.meta.note,
  ]);
  return [CSV_COLUMNS.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
}

/** Located items as a GeoJSON FeatureCollection (QGIS, ArcGIS, geojson.io). */
export function toGeoJson(channel: Channel, abs: (u: string | null) => string | null = (u) => u) {
  return {
    type: 'FeatureCollection' as const,
    name: channel.title,
    features: channel.items
      .filter((i) => i.lat != null && i.lng != null)
      .map((i) => ({
        type: 'Feature' as const,
        id: i.id,
        geometry: { type: 'Point' as const, coordinates: [i.lng!, i.lat!] },
        properties: {
          kind: i.kind, title: i.title, caption: i.caption, tags: i.tags, takenAt: i.takenAt,
          url: abs(i.url), thumbUrl: abs(i.thumbUrl), audioUrl: abs(i.audioUrl),
        },
      })),
  };
}
