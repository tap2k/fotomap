import { eq, sql } from 'drizzle-orm';
import { db, users, channels, items, type User } from '@/lib/db';
import { fail } from '@/lib/http';

const MB = 1024 * 1024;
const UNLIMITED = Number.POSITIVE_INFINITY;

export type Feature = 'collaboration' | 'overlays';

export const PLANS = {
  free: { name: 'Free', storage: 250 * MB, channels: 5, fileSize: 20 * MB, features: [] as Feature[] },
  starter: {
    name: 'Starter',
    storage: 5120 * MB,
    channels: 25,
    fileSize: 100 * MB,
    features: ['collaboration', 'overlays'] as Feature[],
  },
  pro: {
    name: 'Pro',
    storage: 51200 * MB,
    channels: UNLIMITED,
    fileSize: 1024 * MB,
    features: ['collaboration', 'overlays'] as Feature[],
  },
  enterprise: {
    name: 'Enterprise',
    storage: UNLIMITED,
    channels: UNLIMITED,
    fileSize: 4096 * MB,
    features: ['collaboration', 'overlays'] as Feature[],
  },
} satisfies Record<User['plan'], unknown>;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

/** The single kill switch: without it every limit is off (self-hosting). */
export const enforcing = () => process.env.TIER_ENFORCEMENT === 'true';

export type Usage = { storage: number; channels: number };
export type Request =
  | { type: 'channel' }
  | { type: 'upload'; bytes: number }
  | { type: 'feature'; feature: Feature };

/** Pure rule: returns an error message if the request exceeds the plan, otherwise null. */
export function checkLimit(plan: Plan, usage: Usage, req: Request): string | null {
  switch (req.type) {
    case 'channel':
      return usage.channels >= plan.channels ? `The ${plan.name} plan allows ${plan.channels} channels.` : null;
    case 'upload':
      if (req.bytes > plan.fileSize) return `Files on the ${plan.name} plan can be up to ${plan.fileSize / MB} MB.`;
      return usage.storage + req.bytes > plan.storage ? `Storage limit reached for the ${plan.name} plan.` : null;
    case 'feature':
      return plan.features.includes(req.feature) ? null : `This feature isn't included in the ${plan.name} plan.`;
  }
}

export async function usageFor(ownerId: string): Promise<Usage> {
  const [{ storage }] = await db
    .select({ storage: sql<number>`coalesce(sum(${items.bytes}), 0)` })
    .from(items)
    .innerJoin(channels, eq(channels.id, items.channelId))
    .where(eq(channels.ownerId, ownerId));
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(channels)
    .where(sql`${channels.ownerId} = ${ownerId} AND ${channels.parentId} IS NULL`);
  return { storage: Number(storage), channels: Number(count) };
}

/** Throws 402 when the channel owner's plan doesn't allow the request. Limits follow the owner, not the actor. */
export async function assertAllowed(ownerId: string, req: Request) {
  if (!enforcing()) return;
  const [owner] = await db.select().from(users).where(eq(users.id, ownerId));
  if (!owner || owner.isAdmin) return;
  const message = checkLimit(PLANS[owner.plan], await usageFor(ownerId), req);
  if (message) fail(402, message);
}
