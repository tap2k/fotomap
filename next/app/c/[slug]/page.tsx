import { redirect } from 'next/navigation';
import { getViewable } from '@/lib/pages';

export default async function ChannelIndex({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ key?: string }> }) {
  const { slug } = await params;
  const { key } = await searchParams;
  const { channel } = await getViewable(slug, key);
  redirect(`/c/${slug}/${channel.settings.defaultView ?? 'map'}${key ? `?key=${encodeURIComponent(key)}` : ''}`);
}
