import { NextResponse } from 'next/server';
import { appUrl, logout } from '@/lib/auth';

export async function POST() {
  await logout();
  return NextResponse.redirect(appUrl() + '/', { status: 303 });
}
