import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateCodeVerifier, generateState } from 'arctic';
import { google, googleEnabled } from '@/lib/google';
import { safeNext } from '@/lib/auth';

export async function GET(req: Request) {
  if (!googleEnabled()) return new NextResponse('Google sign-in is not configured', { status: 404 });
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google().createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']);
  url.searchParams.set('prompt', 'select_account');
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
  jar.set('g_state', state, opts);
  jar.set('g_verifier', verifier, opts);
  jar.set('g_next', safeNext(new URL(req.url).searchParams.get('next')), opts);
  return NextResponse.redirect(url);
}
