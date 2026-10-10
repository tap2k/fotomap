import Link from 'next/link';
import type { ChannelCard } from '@/lib/listing';

export default function ChannelCards({ channels, href }: { channels: ChannelCard[]; href: (c: ChannelCard) => string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {channels.map((c) => (
        <Link key={c.id} href={href(c)} className="group overflow-hidden rounded-lg border border-line bg-card">
          <div className="aspect-[4/3] bg-line/40">
            {c.cover && <img src={c.cover} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />}
          </div>
          <div className="p-2">
            <div className="truncate font-medium">{c.title}</div>
            <div className="text-xs text-muted">
              {c.count} item{c.count === 1 ? '' : 's'}
              {c.role && c.role !== 'owner' ? ` · ${c.role}` : ''}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
