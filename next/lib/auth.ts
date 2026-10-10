import { cookies } from 'next/headers';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, users, sessions, loginTokens, grants, type User } from '@/lib/db';
import { newId, newToken, sha256 } from '@/lib/crypto';
import { sendMail } from '@/lib/mail';

const COOKIE = 'session';
const SESSION_DAYS = 30;
export const appUrl = () => process.env.APP_URL ?? 'http://localhost:3000';

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row?.user ?? null;
}

async function startSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: appUrl().startsWith('https'),
    path: '/',
    expires: expiresAt,
  });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Finds or creates the user for a verified email, claims pending invites, and signs them in. */
export async function signIn(email: string, name?: string) {
  email = email.trim().toLowerCase();
  let [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) [user] = await db.insert(users).values({ id: newId(), email, name }).returning();
  await db
    .update(grants)
    .set({ userId: user.id, email: null })
    .where(and(eq(grants.email, email), isNull(grants.userId)));
  await startSession(user.id);
  return user;
}

export async function sendLoginLink(email: string, next = '/') {
  email = email.trim().toLowerCase();
  const token = newToken();
  await db.insert(loginTokens).values({ id: sha256(token), email, expiresAt: new Date(Date.now() + 15 * 60e3) });
  const link = `${appUrl()}/api/auth/verify?token=${token}&next=${encodeURIComponent(safeNext(next))}`;
  await sendMail(email, 'Your Fotomap sign-in link', `Sign in to Fotomap:\n\n${link}\n\nThis link expires in 15 minutes.`);
}

/** Consumes a login token; returns the email it was issued for, or null. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const [row] = await db
    .delete(loginTokens)
    .where(and(eq(loginTokens.id, sha256(token)), gt(loginTokens.expiresAt, new Date())))
    .returning();
  return row?.email ?? null;
}

/** Only allow same-site relative redirects. */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
