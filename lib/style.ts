import type { ChannelSettings, Item } from '@/lib/types';

export const DEFAULT_MARKER = '#e4572e';
export const MAP_STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';

/** Marker color: first tag that has a color, else the channel's marker color. */
export function itemColor(item: Pick<Item, 'tags'>, settings: ChannelSettings): string {
  for (const t of item.tags) if (settings.tagColors?.[t]) return settings.tagColors[t];
  return settings.markerColor ?? DEFAULT_MARKER;
}

/** Seconds an item stays on screen in the reel when it has no natural end. */
export const stillSeconds = (item: Item, settings: ChannelSettings) =>
  item.meta.duration ?? settings.interval ?? (item.kind === 'text' ? 6 : 5);

export const located = (i: { lat: number | null; lng: number | null }) => i.lat != null && i.lng != null;
