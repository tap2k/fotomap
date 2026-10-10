import Link from 'next/link';
import Text from '@/components/Text';
import AboutButton from '@/components/site/AboutButton';
import Analytics from '@/components/site/Analytics';
import { themeProps } from '@/lib/themeProps';
import type { Channel } from '@/lib/types';

/**
 * Full-screen cover page: cover image, optional decoration layer, title, tagline, Enter and About.
 * "center" stacks everything in the middle; "side" sets a framed title block on the left.
 */
export default function Welcome({ channel, enterHref }: { channel: Channel; enterHref: string }) {
  const { settings } = channel;
  const welcome = settings.welcome ?? {};
  const side = welcome.layout === 'side';
  const cover = settings.coverUrl ?? channel.items.find((i) => i.kind === 'image')?.url ?? null;
  const onImage = !!cover;
  const about = settings.about && (
    <AboutButton
      title={channel.title}
      about={settings.about}
      pattern={settings.pattern}
      className={`flex items-center gap-1.5 text-sm underline underline-offset-4 ${onImage ? 'text-white/90 hover:text-white' : 'text-muted'}`}
    />
  );

  return (
    <div {...themeProps(settings)} className={`relative flex min-h-dvh overflow-hidden bg-bg text-fg ${side ? 'items-center' : 'flex-col items-center justify-center text-center'}`}>
      {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {cover && <div className={`absolute inset-0 ${side ? 'bg-gradient-to-r from-black/60 via-black/25 to-transparent' : 'bg-gradient-to-b from-black/30 via-black/40 to-black/70'}`} />}
      {welcome.decoration && (
        <img
          src={welcome.decoration}
          alt=""
          aria-hidden
          className={side ? 'pointer-events-none absolute left-0 top-0 h-[85dvh] w-auto max-w-none opacity-85 sm:left-[2vw]' : 'pointer-events-none absolute inset-x-0 top-0 mx-auto h-[60dvh] w-auto opacity-80'}
        />
      )}

      {side ? (
        <main className={`relative z-10 mx-6 flex w-80 flex-col items-stretch text-center sm:ml-[10vw] ${onImage ? 'text-white' : ''}`}>
          <div className="border border-t-0 border-current px-4 pb-6 pt-40 backdrop-blur-[1px] sm:pt-56">
            <h1 className="text-4xl font-semibold leading-tight drop-shadow sm:text-5xl">{channel.title}</h1>
          </div>
          {welcome.tagline && <p className="mt-4 text-3xl drop-shadow" style={{ fontFamily: 'var(--font-script), cursive' }}>{welcome.tagline}</p>}
          <Link href={enterHref} className="mx-auto mt-8 border border-current bg-accent/80 px-10 py-2.5 text-lg tracking-wide text-accent-fg shadow-[0_0_12px_rgba(255,255,255,0.35)] transition hover:bg-accent">
            Enter
          </Link>
          <div className="mt-4 flex justify-center">{about}</div>
        </main>
      ) : (
        <main className={`relative z-10 flex max-w-2xl flex-col items-center gap-5 px-6 ${onImage ? 'text-white' : ''}`}>
          <h1 className="text-5xl font-bold leading-tight drop-shadow sm:text-7xl">{channel.title}</h1>
          {welcome.tagline && <p className="text-xl drop-shadow sm:text-2xl">{welcome.tagline}</p>}
          {channel.description && !welcome.tagline && <Text text={channel.description} className="text-lg drop-shadow" />}
          <Link href={enterHref} className="mt-4 rounded-full bg-accent px-10 py-3 text-lg font-semibold text-accent-fg shadow-lg transition hover:brightness-110">
            Enter
          </Link>
          {about}
        </main>
      )}

      <a href="/" className={`absolute bottom-3 right-3 z-10 text-xs ${onImage ? 'text-white/70' : 'text-muted'}`}>
        Made with Fotomap
      </a>
      <Analytics id={settings.analyticsId} />
    </div>
  );
}
