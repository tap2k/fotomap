import MapView from '@/components/views/MapView';
import ReelView from '@/components/views/ReelView';
import GridView from '@/components/views/GridView';
import StoryView from '@/components/views/StoryView';
import type { Channel, View } from '@/lib/types';

/** Picks the view. Every view is just a function of the same Channel. */
export default function ChannelView({ channel, view, prefix, start, keyParam, item }: { channel: Channel; view: View; prefix: string; start?: number; keyParam?: string; item?: string }) {
  const q = keyParam ? `?key=${encodeURIComponent(keyParam)}` : '';
  switch (view) {
    case 'map':
      return <MapView channel={channel} prefix={prefix} initialItem={item} />;
    case 'reel':
      return <ReelView channel={channel} start={start} />;
    case 'grid':
      return <GridView channel={channel} reelHref={`${prefix}/${channel.slug}/reel${q}`} />;
    case 'story':
      return <StoryView channel={channel} />;
  }
}

export const fillsScreen = (view: View) => view === 'map' || view === 'reel';
