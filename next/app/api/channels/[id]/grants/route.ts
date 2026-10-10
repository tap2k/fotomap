import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, grants, users } from '@/lib/db';
import { fail, route } from '@/lib/http';
import { requireChannel } from '@/lib/access';
import { assertAllowed } from '@/lib/plans';
import { newId, sha256, sign } from '@/lib/crypto';
import { appUrl } from '@/lib/auth';
import { sendMail } from '@/lib/mail';

type Ctx = { params: Promise<{ id: string }> };

/** Members, pending invites and share links on this channel (never the link secrets). */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { channel } = await requireChannel((await params).id, 'manage');
  return db
    .select({
      id: grants.id,
      role: grants.role,
      label: grants.label,
      email: grants.email,
      userEmail: users.email,
      isLink: grants.tokenHash,
      createdAt: grants.createdAt,
    })
    .from(grants)
    .leftJoin(users, eq(users.id, grants.userId))
    .where(eq(grants.channelId, channel.id))
    .then((rows) =>
      rows.map((r) => ({
        ...r,
        email: r.userEmail ?? r.email,
        isLink: !!r.isLink,
        url: r.isLink ? linkUrl(r.id, r.role, channel) : null,
        userEmail: undefined,
      })),
    );
});

// A link's secret is derived from its id and the server SECRET, so managers can see it
// again (e.g. to reprint a QR code) while the database only stores its hash.
const linkToken = (grantId: string) => sign(`link:${grantId}`);

function linkUrl(grantId: string, role: string, channel: { id: string; slug: string }) {
  const token = linkToken(grantId);
  const path = role === 'submitter' ? `/s/${token}` : role === 'editor' ? `/edit/${channel.id}?key=${token}` : `/c/${channel.slug}?key=${token}`;
  return appUrl() + path;
}

const createSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('invite'), email: z.email(), role: z.enum(['owner', 'editor', 'viewer']) }),
  z.object({ type: z.literal('link'), role: z.enum(['editor', 'viewer', 'submitter']), label: z.string().max(100).default('') }),
]);

/** Invite a person by email, or create a share link. A link's secret is returned once, here. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { channel, actor } = await requireChannel((await params).id, 'manage');
  const input = createSchema.parse(await req.json());
  if (input.role === 'editor' || input.role === 'owner')
    await assertAllowed(channel.ownerId, { type: 'feature', feature: 'collaboration' });

  if (input.type === 'link') {
    const id = newId();
    await db.insert(grants).values({ id, channelId: channel.id, role: input.role, tokenHash: sha256(linkToken(id)), label: input.label });
    return { url: linkUrl(id, input.role, channel) };
  }

  const email = input.email.toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  await db.insert(grants).values({
    id: newId(),
    channelId: channel.id,
    role: input.role,
    ...(user ? { userId: user.id } : { email }),
  });
  const inviter = actor.user?.email ?? 'Someone';
  await sendMail(
    email,
    `${inviter} shared "${channel.title}" with you on Fotomap`,
    `${inviter} invited you to ${input.role === 'viewer' ? 'view' : 'edit'} "${channel.title}".\n\nOpen it: ${appUrl()}${input.role === 'viewer' ? `/c/${channel.slug}` : `/edit/${channel.id}`}\n\nSign in with this email address (${email}) to get access.`,
  );
  return { ok: true };
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const { channel } = await requireChannel((await params).id, 'manage');
  const { grantId } = z.object({ grantId: z.string() }).parse(await req.json());
  const all = await db.select().from(grants).where(eq(grants.channelId, channel.id));
  const target = all.find((g) => g.id === grantId) ?? fail(404, 'Not found');
  if (!channel.parentId && target.role === 'owner' && target.userId && all.filter((g) => g.role === 'owner' && g.userId).length === 1)
    fail(400, 'A channel needs at least one owner');
  await db.delete(grants).where(and(eq(grants.id, grantId), eq(grants.channelId, channel.id)));
  return { ok: true };
});
