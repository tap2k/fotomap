'use client';

import Media from '@/components/Media';
import Text from '@/components/Text';
import type { Item } from '@/lib/types';

/** Media + title + caption + tags. Used by the map panel and the story chapters. */
export default function ItemCard({ item, autoplay = false }: { item: Item; autoplay?: boolean }) {
  const tall = item.kind === 'text';
  return (
    <article>
      {!tall && (
        <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-black/5">
          <Media item={item} autoplay={autoplay} />
        </div>
      )}
      <div className="mt-3 space-y-2">
        {item.title && <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>}
        <Text text={item.caption} className="text-sm leading-relaxed" />
        {(item.tags.length > 0 || item.meta.contributor?.name || item.takenAt) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {item.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
            {item.meta.contributor?.name && <span>by {item.meta.contributor.name}</span>}
            {item.takenAt && <span>{new Date(item.takenAt).toLocaleDateString()}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
