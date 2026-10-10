'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MapCanvas, { type MapPoint } from '@/components/MapCanvas';
import ItemCard from '@/components/views/ItemCard';
import { itemColor, located } from '@/lib/style';
import type { Channel } from '@/lib/types';

export default function MapView({ channel, prefix }: { channel: Channel; prefix: string }) {
  const router = useRouter();
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  const { settings } = channel;

  const visible = useMemo(
    () => channel.items.filter((i) => located(i) && !(i.tags.length && i.tags.every((t) => hiddenTags.includes(t)))),
    [channel.items, hiddenTags],
  );
  const points = useMemo<MapPoint[]>(
    () => [
      ...visible.map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, color: itemColor(i, settings) })),
      ...channel.children.filter(located).map((c) => ({ id: `channel:${c.slug}`, lat: c.lat!, lng: c.lng!, color: '#1d2327', isChannel: true })),
    ],
    [visible, channel.children, settings],
  );
  const legend = Object.entries(settings.tagColors ?? {}).filter(([t]) => channel.items.some((i) => i.tags.includes(t)));
  const index = visible.findIndex((i) => i.id === selectedId);
  const selected = visible[index];
  const step = (d: number) => setSelectedId(visible[(index + d + visible.length) % visible.length].id);

  const select = (id: string) =>
    id.startsWith('channel:') ? router.push(`${prefix}/${id.slice(8)}/map`) : setSelectedId(id);

  return (
    <div className="relative h-full w-full">
      <MapCanvas
        points={points}
        mapSettings={settings}
        initial={channel.lat != null && channel.lng != null ? { lat: channel.lat, lng: channel.lng, zoom: channel.zoom ?? 10 } : null}
        focus={selected ? { lat: selected.lat!, lng: selected.lng!, zoom: selected.meta.camera?.zoom } : null}
        selectedId={selectedId}
        onSelect={select}
      />
      {legend.length > 0 && (
        <div className="absolute left-2 top-2 max-w-[60%] rounded-md bg-bg/90 p-2 text-xs shadow">
          {legend.map(([tag, color]) => (
            <label key={tag} className="flex cursor-pointer items-center gap-1.5 py-0.5">
              <input
                type="checkbox"
                checked={!hiddenTags.includes(tag)}
                onChange={() => setHiddenTags((h) => (h.includes(tag) ? h.filter((t) => t !== tag) : [...h, tag]))}
              />
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
              {tag}
            </label>
          ))}
        </div>
      )}
      {selected && (
        <aside
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const dx = touchX.current == null ? 0 : e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
          className="fade-in absolute inset-x-0 bottom-0 max-h-[65%] overflow-y-auto rounded-t-xl bg-bg p-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-h-[calc(100%-1.5rem)] sm:w-96 sm:rounded-xl">
          <div className="mb-2 flex items-center justify-between text-sm">
            <div className="flex gap-1">
              <button className="btn" onClick={() => step(-1)} aria-label="Previous">‹</button>
              <button className="btn" onClick={() => step(1)} aria-label="Next">›</button>
            </div>
            <span className="text-muted">{index + 1} / {visible.length}</span>
            <button className="btn" onClick={() => setSelectedId(null)} aria-label="Close">✕</button>
          </div>
          <ItemCard key={selected.id} item={selected} />
        </aside>
      )}
      {points.length === 0 && (
        <div className="absolute inset-x-0 top-1/3 mx-auto w-fit rounded-md bg-bg/90 px-4 py-2 text-sm text-muted shadow">
          Nothing with a location yet.
        </div>
      )}
    </div>
  );
}
