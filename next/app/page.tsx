import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { myChannels, publicChannels } from '@/lib/listing';
import ChannelCards from '@/components/ChannelCards';
import NewChannel from '@/components/NewChannel';

const USE_CASES = [
  ['Participatory mapping', 'Gather local knowledge and see it on a shared multimedia map.'],
  ['Photovoice', 'Let communities tell their own stories through photos, audio and text.'],
  ['Oral history', 'Record spoken testimony and connect it to where it happened.'],
  ['Cultural probes', 'Give participants a simple way to capture experiences in context.'],
];

const STEPS = [
  ['Collect', 'Share a submission link or QR code. Contributors add photos, video, audio and notes from their phones — no account needed. Location comes from the photo.'],
  ['Curate', 'Approve submissions, tag and annotate them, put them in order.'],
  ['Share', 'Publish as a map, slideshow, grid or scrolling story — and embed it anywhere. Export everything as CSV, GeoJSON or a ZIP.'],
];

export default async function Home() {
  const [user, featured] = await Promise.all([getUser(), publicChannels()]);
  const mine = user ? await myChannels(user.id) : [];

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon-32x32.png" alt="" className="h-6 w-6" /> Fotomap
        </Link>
        {user ? (
          <form action="/api/auth/logout" method="post" className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <button className="btn">Sign out</button>
          </form>
        ) : (
          <Link href="/login" className="btn-primary">Sign in</Link>
        )}
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-8">
        {user ? (
          <section className="space-y-4">
            <h1 className="text-2xl font-semibold">Your channels</h1>
            <NewChannel />
            {mine.length ? (
              <ChannelCards channels={mine} href={(c) => `/edit/${c.id}`} />
            ) : (
              <p className="text-muted">Create your first channel to start collecting.</p>
            )}
          </section>
        ) : (
          <>
            <section className="space-y-4 py-6 text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Tell stories with maps, slideshows and multimedia</h1>
              <p className="mx-auto max-w-2xl text-lg text-muted">
                Fotomap helps communities, researchers and storytellers collect photos, video and sound from the field — and share
                them back as maps and stories.
              </p>
              <Link href="/login" className="btn-primary px-5 py-2.5 text-base">Get started — it’s free</Link>
            </section>
            <section className="grid gap-4 sm:grid-cols-3">
              {STEPS.map(([title, text]) => (
                <div key={title} className="rounded-lg bg-card p-5">
                  <h2 className="mb-1 font-semibold">{title}</h2>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              ))}
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Built for participatory research</h2>
              <div className="grid gap-4 sm:grid-cols-4">
                {USE_CASES.map(([title, text]) => (
                  <div key={title} className="rounded-lg border border-line p-4">
                    <h3 className="mb-1 font-medium">{title}</h3>
                    <p className="text-sm text-muted">{text}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {featured.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Public channels</h2>
            <ChannelCards channels={featured} href={(c) => `/c/${c.slug}`} />
          </section>
        )}
      </main>
      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
        Fotomap is open source (MIT) and can be self-hosted.
      </footer>
    </div>
  );
}
