import { redirect } from 'next/navigation';
import { getUser, safeNext } from '@/lib/auth';
import { googleEnabled } from '@/lib/google';
import LoginForm from '@/components/LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getUser()) redirect(safeNext(next));
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <a href="/" className="flex items-center gap-2 text-xl font-semibold">
        <img src="/favicon-32x32.png" alt="" className="h-7 w-7" /> Fotomap
      </a>
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error === 'expired' ? 'That sign-in link has expired or was already used. Request a new one.' : 'Sign-in failed. Please try again.'}
        </p>
      )}
      <LoginForm next={safeNext(next)} />
      {googleEnabled() && (
        <>
          <div className="text-center text-xs text-muted">or</div>
          <a className="btn w-full py-2" href={`/api/auth/google?next=${encodeURIComponent(safeNext(next))}`}>
            Continue with Google
          </a>
        </>
      )}
      <p className="text-xs text-muted">No password needed. New here? Signing in creates your account.</p>
    </main>
  );
}
