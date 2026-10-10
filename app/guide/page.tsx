import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Getting started',
  description: 'How to collect photos, video and voices with Fotomap and share them as maps and stories.',
};

const STEPS: { title: string; image: string; body: React.ReactNode }[] = [
  {
    title: 'Start a project',
    image: 'new-project',
    body: (
      <>
        Sign in with your email (no password), press <b>New project</b> and pick a starting point: a photo map, photovoice, a participatory map, an oral history or a story
        map. Templates only pre-fill settings; you can change everything later.
      </>
    ),
  },
  {
    title: 'Add your media',
    image: 'content',
    body: (
      <>
        Drag photos, videos or audio onto <b>Content</b>, record a voice note, paste a YouTube or Vimeo link, or write a text card. Photos are resized in your browser, and their
        location and date are read automatically. Drag cards to change the order used by the slideshow and the story.
      </>
    ),
  },
  {
    title: 'Caption, tag and place',
    image: 'item',
    body: (
      <>
        Click an item to give it a title, caption and tags. Use the arrows to move through items quickly. If a photo has no location, search for the place or click the map. You
        can record a voice-over that plays with the photo, and keep private notes only editors see. Everything saves as you type.
      </>
    ),
  },
  {
    title: 'Collect from others',
    image: 'collect',
    body: (
      <>
        On <b>Collect</b>, turn on contributions to get a link and a QR code for posters, workshops or messages. Write an invitation, an optional consent statement, and choose
        how precisely locations are kept: exact, about 1 km, or not at all.
      </>
    ),
  },
  {
    title: 'Contributors send from their phones',
    image: 'contribute',
    body: <>Participants open the link, take or choose photos, record their voice or write something, and press Send. They don’t need an account or an app.</>,
  },
  {
    title: 'Review what arrives',
    image: 'inbox',
    body: (
      <>
        New contributions wait in your <b>Inbox</b>. Nothing is public until you approve it. Edit before approving, or reject what doesn’t belong.
      </>
    ),
  },
  {
    title: 'Make it yours',
    image: 'design',
    body: (
      <>
        On <b>Design</b>, choose whether it opens as a map, slideshow, grid or story, pick a theme, font and brand color, and set the map’s starting view. Under{' '}
        <b>Website</b> you can add a welcome page, an About text, a pattern and your own domain.
      </>
    ),
  },
  {
    title: 'Share it',
    image: 'share',
    body: (
      <>
        Press <b>Share</b> to choose who can see it (only people you invite, anyone with the link, or everyone), copy the link or QR code, embed it on a website, or invite
        co-editors by email.
      </>
    ),
  },
  {
    title: 'Present it',
    image: 'story',
    body: (
      <>
        Visitors can switch between the <b>map</b>, a full-screen <b>slideshow</b>, a <b>grid</b> and a scrolling <b>story</b> where the map follows along. Use the arrow keys and
        space bar in the slideshow.
      </>
    ),
  },
];

const FAQ: [string, React.ReactNode][] = [
  ['Do contributors need an account?', 'No. Anyone with the contribution link can send things. Only you and your co-editors sign in.'],
  ['How do I protect people’s privacy?', 'Keep the project private or share it only by link, set location precision to approximate or none, add a consent statement, and approve each contribution before it appears.'],
  ['Can I get my data out?', <>Yes. <b>More → Export</b> gives you a spreadsheet (CSV, for Excel, NVivo or Atlas.ti), map data (GeoJSON, for QGIS) or a ZIP of every file.</>],
  ['Can several people edit?', 'Yes. Invite them by email from Share. Sub-projects (More → Sub-projects) let you split a big project, for example one per neighbourhood or workshop.'],
  ['What files work?', 'Photos (JPEG, PNG, GIF, WebP), video (MP4, WebM, MOV), audio (MP3, WAV, M4A and voice notes), 360° photos and video, and links to YouTube, Vimeo or any web page.'],
  ['Can I run it myself?', 'Yes. Fotomap is open source (MIT) and runs as a single container with a small database file.'],
];

export default function GuidePage() {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/" className="rounded p-1 text-muted hover:bg-card" aria-label="Home">
          <ArrowLeft size={18} />
        </Link>
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon-32x32.png" alt="" className="h-6 w-6" /> Fotomap
        </Link>
        <span className="text-muted">/ Getting started</span>
      </header>
      <main className="mx-auto max-w-4xl space-y-14 px-4 py-10">
        <section className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Getting started</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted">From an empty project to a shared map in a few minutes: add your own media, invite others to contribute, review, and share.</p>
          <video controls preload="metadata" poster="/guide/getting-started-poster.jpg" className="mx-auto mt-6 w-full rounded-xl border border-line shadow-lg" aria-label="Walkthrough video">
              <source src="/guide/getting-started.mp4" type="video/mp4" />
            </video>
          <Link href="/login" className="btn-primary mt-4 px-5 py-2.5 text-base">
            Start a project
          </Link>
        </section>

        <ol className="space-y-12">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid items-center gap-6 md:grid-cols-5">
              <div className={`space-y-2 md:col-span-2 ${i % 2 ? 'md:order-2' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-fg">{i + 1}</span>
                  <h2 className="text-xl font-semibold">{s.title}</h2>
                </div>
                <p className="leading-relaxed text-muted">{s.body}</p>
              </div>
              <img src={`/guide/${s.image}.jpg`} alt={s.title} loading="lazy" className="w-full rounded-xl border border-line shadow md:col-span-3" />
            </li>
          ))}
        </ol>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Questions</h2>
          <div className="divide-y divide-line rounded-xl border border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-4">
                <summary className="cursor-pointer font-medium">{q}</summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-card p-6 text-center">
          <p className="mb-3 text-lg font-medium">Ready?</p>
          <Link href="/login" className="btn-primary px-5 py-2.5 text-base">
            Start a project
          </Link>
        </section>
      </main>
    </div>
  );
}
