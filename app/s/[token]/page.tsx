import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, channels, grants } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import SubmitForm from '@/components/SubmitForm';
import Text from '@/components/Text';

export const metadata = { title: 'Contribute', robots: { index: false } };

/** Public contribution page reached through a submitter share link (or QR code). */
export default async function SubmitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ channel: channels, role: grants.role })
    .from(grants)
    .innerJoin(channels, eq(channels.id, grants.channelId))
    .where(eq(grants.tokenHash, sha256(token)));
  if (!row || !['submitter', 'editor', 'owner'].includes(row.role)) notFound();
  const { channel } = row;
  const s = channel.settings.submissions ?? {};

  return (
    <div data-theme={channel.settings.theme ?? 'light'} className="min-h-dvh bg-bg text-fg">
      <main className="mx-auto max-w-xl space-y-5 p-4 pb-16 sm:p-8">
        {channel.settings.coverUrl && <img src={channel.settings.coverUrl} alt="" className="max-h-56 w-full rounded-lg object-cover" />}
        <h1 className="text-2xl font-semibold">{channel.title}</h1>
        <Text text={s.prompt || channel.description} className="text-muted" />
        <SubmitForm
          channelId={channel.id}
          token={token}
          consent={s.consent ?? ''}
          askName={!!s.askName}
          locationPrecision={s.locationPrecision ?? 'exact'}
        />
      </main>
    </div>
  );
}
