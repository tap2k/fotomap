import { NextResponse } from 'next/server';
import { appUrl, consumeLoginToken, safeNext, signIn } from '@/lib/auth';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const email = await consumeLoginToken(params.get('token') ?? '');
  if (!email) return NextResponse.redirect(`${appUrl()}/login?error=expired`);
  await signIn(email);
  return NextResponse.redirect(appUrl() + safeNext(params.get('next')));
}
