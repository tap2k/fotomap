import { z } from 'zod';
import { fail, route } from '@/lib/http';
import { requireChannel } from '@/lib/access';
import { assertAllowed } from '@/lib/plans';
import { appUrl } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Asks the external video service to render the channel. The service replies 202 at once and
 * emails the result. It reads the channel from /api/compat/getChannel (the old Strapi shape).
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const base = process.env.VIDEO_SERVER_URL;
  if (!base) fail(503, 'Video generation is not available');
  const { channel, actor } = await requireChannel((await params).id, 'edit');
  await assertAllowed(channel.ownerId, { type: 'feature', feature: 'videoGeneration' });
  const { email } = z.object({ email: z.email().optional() }).parse(await req.json().catch(() => ({})));
  const to = email ?? actor.user?.email ?? fail(400, 'An email address is needed for the result');
  const res = await fetch(`${base}/mvc_video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelid: channel.slug, url: `${appUrl()}/api/compat`, email: to }),
  });
  if (!res.ok) fail(502, 'The video service did not accept the request');
  return new Response(JSON.stringify({ ok: true }), { status: 202 });
});
