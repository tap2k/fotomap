import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getViewable } from '@/lib/pages';
import Welcome from '@/components/site/Welcome';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ key?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { channel } = await getViewable((await params).slug, (await searchParams).key);
  return { title: channel.title, description: channel.settings.welcome?.tagline ?? (channel.description.slice(0, 200) || undefined) };
}

/** Project home: the welcome page if enabled, otherwise straight into the default view. */
export default async function ChannelIndex({ params, searchParams }: Props) {
  const { slug } = await params;
  const { key } = await searchParams;
  const { channel } = await getViewable(slug, key);
  const enter = `/c/${slug}/${channel.settings.defaultView ?? 'map'}${key ? `?key=${encodeURIComponent(key)}` : ''}`;
  if (channel.settings.welcome?.enabled) return <Welcome channel={channel} enterHref={enter} />;
  redirect(enter);
}
