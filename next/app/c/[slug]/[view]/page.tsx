import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChannelView, { fillsScreen } from '@/components/views/ChannelView';
import { getViewable } from '@/lib/pages';
import { VIEWS, type View } from '@/lib/types';

type Props = { params: Promise<{ slug: string; view: string }>; searchParams: Promise<{ key?: string; i?: string }> };

const LABELS: Record<View, string> = { map: 'Map', reel: 'Slideshow', grid: 'Grid', story: 'Story' };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { channel } = await getViewable((await params).slug, (await searchParams).key);
  const image = channel.settings.coverUrl ?? channel.items.find((i) => i.thumbUrl || i.kind === 'image')?.thumbUrl ?? undefined;
  return {
    title: channel.title,
    description: channel.description.slice(0, 200) || undefined,
    openGraph: { title: channel.title, images: image ? [image] : undefined },
    robots: channel.visibility === 'public' ? undefined : { index: false },
  };
}

export default async function ChannelPage({ params, searchParams }: Props) {
  const { slug, view } = await params;
  const { key, i } = await searchParams;
  if (!VIEWS.includes(view as View)) notFound();
  const { channel, canEdit } = await getViewable(slug, key);
  const q = key ? `?key=${encodeURIComponent(key)}` : '';
  const full = fillsScreen(view as View);

  return (
    <div data-theme={channel.settings.theme ?? 'light'} className={full ? 'flex h-dvh flex-col bg-bg text-fg' : 'min-h-dvh bg-bg text-fg'}>
      <header className={`z-20 flex items-center gap-3 border-b border-line bg-bg px-3 py-2 ${view === 'grid' ? 'sticky top-0' : ''}`}>
        <Link href="/" className="shrink-0" aria-label="Fotomap home">
          <img src="/favicon-32x32.png" alt="" className="h-6 w-6" />
        </Link>
        <div className="min-w-0 flex-1">
          {channel.parent && (
            <Link href={`/c/${channel.parent.slug}/${view}`} className="block truncate text-xs text-muted hover:underline">
              ← {channel.parent.title}
            </Link>
          )}
          <h1 className="truncate font-semibold">{channel.title}</h1>
        </div>
        <nav className="flex shrink-0 gap-1 text-sm">
          {VIEWS.map((v) => (
            <Link key={v} href={`/c/${slug}/${v}${q}`} className={`rounded px-2 py-1 ${v === view ? 'bg-accent text-accent-fg' : 'hover:bg-card'}`}>
              {LABELS[v]}
            </Link>
          ))}
          {canEdit && (
            <Link href={`/edit/${channel.id}`} className="ml-1 rounded border border-line px-2 py-1 hover:bg-card">
              Edit
            </Link>
          )}
        </nav>
      </header>
      <main className={full ? 'relative min-h-0 flex-1' : ''}>
        <ChannelView channel={channel} view={view as View} prefix="/c" start={Number(i) || 0} keyParam={key} />
      </main>
    </div>
  );
}
