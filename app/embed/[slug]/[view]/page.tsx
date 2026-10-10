import { notFound } from 'next/navigation';
import ChannelView, { fillsScreen } from '@/components/views/ChannelView';
import { getViewable } from '@/lib/pages';
import { VIEWS, type View } from '@/lib/types';
import { appUrl } from '@/lib/auth';

type Props = { params: Promise<{ slug: string; view: string }>; searchParams: Promise<{ key?: string; i?: string }> };

export const metadata = { robots: { index: false } };

/** Chrome-free view for <iframe> embeds, with a link back to the full page. */
export default async function EmbedPage({ params, searchParams }: Props) {
  const { slug, view } = await params;
  const { key, i } = await searchParams;
  if (!VIEWS.includes(view as View)) notFound();
  const { channel } = await getViewable(slug, key);
  return (
    <div data-theme={channel.settings.theme ?? 'light'} data-font={channel.settings.font ?? 'sans'} className={`relative bg-bg text-fg ${fillsScreen(view as View) ? 'h-dvh' : 'min-h-dvh'}`}>
      <ChannelView channel={channel} view={view as View} prefix="/embed" start={Number(i) || 0} keyParam={key} />
      <a
        href={`${appUrl()}/c/${slug}/${view}`}
        target="_blank"
        rel="noopener"
        className="fixed bottom-1 left-1 z-30 rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-black/70 no-underline"
      >
        {channel.title} · Fotomap
      </a>
    </div>
  );
}
