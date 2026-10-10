'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function NewChannel({ parentId, label = 'New channel' }: { parentId?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const title = String(new FormData(e.currentTarget).get('title') ?? '').trim();
        if (!title) return;
        setBusy(true);
        try {
          const c = await api<{ id: string }>('/api/channels', { method: 'POST', body: { title, parentId } });
          router.push(`/edit/${c.id}`);
        } catch (err) {
          alert((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <input name="title" required maxLength={200} placeholder="Title, e.g. Neighbourhood Voices 2026" className="input" />
      <button className="btn-primary shrink-0" disabled={busy}>
        {label}
      </button>
    </form>
  );
}
