import Link from 'next/link';
import Text from '@/components/Text';
import AboutButton from '@/components/site/AboutButton';
import Analytics from '@/components/site/Analytics';
import type { Channel } from '@/lib/types';

/** Full-screen cover page: the project's image, title, tagline, Enter and About. */
export default function Welcome({ channel, enterHref }: { channel: Channel; enterHref: string }) {
  const { settings } = channel;
  const cover = settings.coverUrl ?? channel.items.find((i) => i.kind === 'image')?.url ?? null;
  return (
    <div data-theme={settings.theme ?? 'light'} data-font={settings.font ?? 'sans'} className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg text-center text-fg">
      {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {cover && <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />}
      <main className={`relative z-10 flex max-w-2xl flex-col items-center gap-5 px-6 ${cover ? 'text-white' : ''}`}>
        <h1 className="text-5xl font-bold leading-tight drop-shadow sm:text-7xl">{channel.title}</h1>
        {settings.welcome?.tagline && <p className="text-xl drop-shadow sm:text-2xl">{settings.welcome.tagline}</p>}
        {channel.description && !settings.welcome?.tagline && <Text text={channel.description} className="text-lg drop-shadow" />}
        <Link href={enterHref} className="mt-4 rounded-full bg-accent px-10 py-3 text-lg font-semibold text-accent-fg shadow-lg transition hover:brightness-110">
          Enter
        </Link>
        {settings.about && (
          <AboutButton title={channel.title} about={settings.about} className={`flex items-center gap-1.5 text-sm underline-offset-4 hover:underline ${cover ? 'text-white/90' : 'text-muted'}`} />
        )}
      </main>
      <a href="/" className={`absolute bottom-3 right-3 z-10 text-xs ${cover ? 'text-white/70' : 'text-muted'}`}>
        Made with Fotomap
      </a>
      <Analytics id={settings.analyticsId} />
    </div>
  );
}
