'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MapCanvas, { type Focus, type MapPoint } from '@/components/MapCanvas';
import ItemCard from '@/components/views/ItemCard';
import Text from '@/components/Text';
import { itemColor, located } from '@/lib/style';
import type { Channel } from '@/lib/types';

/**
 * Scrollytelling: chapters scroll past a sticky map that flies to each located item.
 * Items without a location keep the previous map position.
 */
export default function StoryView({ channel }: { channel: Channel }) {
  const { items, settings } = channel;
  const [active, setActive] = useState(-1); // -1 = title chapter
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  const points = useMemo<MapPoint[]>(
    () => items.filter(located).map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, color: itemColor(i, settings) })),
    [items, settings],
  );

  // Last located item at or before the active chapter.
  const focusItem = useMemo(() => {
    for (let i = active; i >= 0; i--) if (located(items[i])) return items[i];
    return null;
  }, [active, items]);
  const focus = useMemo<Focus | null>(
    () =>
      focusItem
        ? { lat: focusItem.lat!, lng: focusItem.lng!, zoom: focusItem.meta.camera?.zoom ?? 13, bearing: focusItem.meta.camera?.bearing, pitch: focusItem.meta.camera?.pitch }
        : channel.lat != null && channel.lng != null
          ? { lat: channel.lat, lng: channel.lng, zoom: channel.zoom ?? 4 }
          : null,
    [focusItem, channel.lat, channel.lng, channel.zoom],
  );

  return (
    <div className="relative sm:flex">
      <div className="sticky top-0 z-0 h-[45dvh] sm:order-2 sm:h-dvh sm:flex-1">
        <MapCanvas points={points} mapSettings={settings} focus={focus} selectedId={focusItem?.id} cluster={false} />
      </div>
      <div className="relative z-10 sm:order-1 sm:w-[min(32rem,45%)]">
        <section ref={(el) => { refs.current[0] = el; }} data-index={-1} className="mx-4 my-[20dvh] flex flex-col justify-center rounded-xl bg-bg p-6 shadow-lg sm:mx-0 sm:my-0 sm:min-h-[70dvh] sm:rounded-none sm:bg-transparent sm:p-10 sm:shadow-none">
          <h1 className="text-3xl font-bold sm:text-4xl">{channel.title}</h1>
          <Text text={channel.description} className="mt-4 text-muted" />
          {items.length > 0 && <p className="mt-8 text-sm text-muted">Scroll to begin ↓</p>}
        </section>
        {items.map((item, i) => (
          <section
            key={item.id}
            ref={(el) => { refs.current[i + 1] = el; }}
            data-index={i}
            className={`mx-4 mb-[40dvh] rounded-xl bg-bg p-4 shadow-lg transition-opacity sm:mx-8 ${active === i ? 'opacity-100' : 'opacity-60'}`}
          >
            <ItemCard item={item} />
          </section>
        ))}
      </div>
    </div>
  );
}
