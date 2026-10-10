'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function LoginForm({ next }: { next: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  return state === 'sent' ? (
    <p className="rounded-md bg-card p-4 text-sm">Check your email for a sign-in link. You can close this tab.</p>
  ) : (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending');
        setError('');
        try {
          await api('/api/auth/email', { method: 'POST', body: { email: new FormData(e.currentTarget).get('email'), next } });
          setState('sent');
        } catch (err) {
          setError((err as Error).message);
          setState('idle');
        }
      }}
    >
      <label className="label" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@example.org" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full py-2" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
