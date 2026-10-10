import { notFound, redirect } from 'next/navigation';
import { getActor, requireChannel } from '@/lib/access';
import { loadChannel } from '@/lib/channel';
import { HttpError } from '@/lib/http';
import { appUrl } from '@/lib/auth';
import { enforcing, PLANS, usageFor } from '@/lib/plans';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import Editor from '@/components/editor/Editor';

export const metadata = { title: 'Edit', robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ key?: string }> };

export default async function EditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { key } = await searchParams;
  let access;
  try {
    access = await requireChannel(id, 'edit', await getActor(key));
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) redirect(`/login?next=${encodeURIComponent(`/edit/${id}`)}`);
    if (err instanceof HttpError) notFound();
    throw err;
  }
  const { channel: row, roles, actor } = access;
  const channel = await loadChannel(row, { drafts: true });

  let plan = null;
  if (enforcing()) {
    const [owner] = await db.select().from(users).where(eq(users.id, row.ownerId));
    const p = PLANS[owner?.plan ?? 'free'];
    plan = { name: p.name, storage: p.storage, used: (await usageFor(row.ownerId)).storage, features: p.features };
  }

  return (
    <Editor
      initial={channel}
      shareKey={key ?? null}
      isOwner={roles.includes('owner')}
      signedIn={!!actor.user}
      appUrl={appUrl()}
      videoEnabled={!!process.env.VIDEO_SERVER_URL}
      plan={plan}
    />
  );
}
