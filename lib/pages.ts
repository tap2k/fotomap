import { notFound } from 'next/navigation';
import { getActor, requireChannel } from '@/lib/access';
import { loadChannel } from '@/lib/channel';
import { HttpError } from '@/lib/http';

/** Loads a channel for a public page (published items), or 404s. */
export async function getViewable(slug: string, key?: string) {
  try {
    const { channel, roles } = await requireChannel(slug, 'view', await getActor(key));
    return {
      channel: await loadChannel(channel),
      canEdit: roles.some((r) => r === 'owner' || r === 'editor'),
    };
  } catch (err) {
    if (err instanceof HttpError) notFound();
    throw err;
  }
}
