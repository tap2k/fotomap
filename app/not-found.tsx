import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted">This page doesn’t exist, or you don’t have access to it.</p>
      <Link href="/" className="btn">Go home</Link>
    </main>
  );
}
