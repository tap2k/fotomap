import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChannelView, { fillsScreen } from '@/components/views/ChannelView';
import { getViewable } from '@/lib/pages';
import { VIEWS, type View } from '@/lib/types';
import { Pencil } from 'lucide-react';
import { VIEW_LABELS } from '@/components/viewMeta';
import AboutButton from '@/components/site/AboutButton';
import Analytics from '@/components/site/Analytics';

type Props = { params: Promise<{ slug: string; view: string }>; searchParams: Promise<{ key?: string; i?: string }> };

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
    <div data-theme={channel.settings.theme ?? 'light'} data-font={channel.settings.font ?? 'sans'} className={full ? 'flex h-dvh flex-col bg-bg text-fg' : 'min-h-dvh bg-bg text-fg'}>
      <header className={`z-20 flex items-center gap-3 border-b border-line bg-bg px-3 py-2 ${view === 'grid' ? 'sticky top-0' : ''}`}>
        <Link href={channel.settings.welcome?.enabled ? `/c/${slug}${q}` : '/'} className="shrink-0" aria-label="Home">
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
        <nav className="flex shrink-0 gap-0.5 text-sm" aria-label="Views">
          {VIEW_LABELS.map(({ view: v, label, Icon }) => (
            <Link
              key={v}
              href={`/c/${slug}/${v}${q}`}
              title={label}
              aria-current={v === view ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 ${v === view ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-card hover:text-fg'}`}
            >
              <Icon size={16} />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
          {channel.settings.about && (
            <AboutButton title={channel.title} about={channel.settings.about} iconOnly className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted hover:bg-card hover:text-fg" />
          )}
          {canEdit && (
            <Link href={`/edit/${channel.id}`} className="ml-1 flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 hover:bg-card" title="Edit">
              <Pencil size={16} />
              <span className="hidden md:inline">Edit</span>
            </Link>
          )}
        </nav>
      </header>
      <main className={full ? 'relative min-h-0 flex-1' : ''}>
        <ChannelView channel={channel} view={view as View} prefix="/c" start={Number(i) || 0} keyParam={key} />
      </main>
      <Analytics id={channel.settings.analyticsId} />
    </div>
  );
}
