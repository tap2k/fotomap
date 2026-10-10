import Link from 'next/link';
import Media from '@/components/Media';
import type { Channel } from '@/lib/types';

/** Masonry grid of thumbnails; each opens the reel at that item. */
export default function GridView({ channel, reelHref }: { channel: Channel; reelHref: string }) {
  if (!channel.items.length) return <div className="p-10 text-center text-muted">Nothing here yet.</div>;
  return (
    <div className="columns-2 gap-3 p-3 sm:columns-3 lg:columns-4">
      {channel.items.map((item, i) => (
        <Link key={item.id} href={`${reelHref}${reelHref.includes('?') ? '&' : '?'}i=${i}`} className="mb-3 block break-inside-avoid overflow-hidden rounded-md bg-card">
          <div className={item.thumbUrl || item.kind === 'image' ? '' : 'aspect-square'}>
            <Media item={item} mode="thumb" fit="cover" />
          </div>
          {item.title && <div className="px-2 py-1.5 text-sm">{item.title}</div>}
        </Link>
      ))}
    </div>
  );
}
