import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeIdToken } from 'arctic';
import { google } from '@/lib/google';
import { appUrl, safeNext, signIn } from '@/lib/auth';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const state = jar.get('g_state')?.value;
  const verifier = jar.get('g_verifier')?.value;
  const next = safeNext(jar.get('g_next')?.value);
  ['g_state', 'g_verifier', 'g_next'].forEach((c) => jar.delete(c));
  if (!state || !verifier || params.get('state') !== state) return NextResponse.redirect(`${appUrl()}/login?error=google`);
  try {
    const tokens = await google().validateAuthorizationCode(params.get('code') ?? '', verifier);
    const claims = decodeIdToken(tokens.idToken()) as { email?: string; email_verified?: boolean; name?: string };
    if (!claims.email || !claims.email_verified) throw new Error('Unverified email');
    await signIn(claims.email, claims.name);
    return NextResponse.redirect(appUrl() + next);
  } catch {
    return NextResponse.redirect(`${appUrl()}/login?error=google`);
  }
}
