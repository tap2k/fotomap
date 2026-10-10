'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import type { ChannelSettings } from '@/lib/types';

/** Title box + button that creates a project (or sub-project) and opens it. */
export default function NewChannel({
  parentId,
  label = 'Create',
  placeholder = 'Project title',
  settings,
  description,
  autoFocus,
}: {
  parentId?: string;
  label?: string;
  placeholder?: string;
  settings?: ChannelSettings;
  description?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
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
          const c = await api<{ id: string }>('/api/channels', { method: 'POST', body: { title, parentId, settings, description } });
          router.push(`/edit/${c.id}`);
        } catch (err) {
          toast((err as Error).message, 'error');
          setBusy(false);
        }
      }}
    >
      <input name="title" required maxLength={200} placeholder={placeholder} className="input" autoFocus={autoFocus} aria-label={placeholder} />
      <button className="btn-primary shrink-0" disabled={busy}>
        <Plus size={16} /> {busy ? 'Creating…' : label}
      </button>
    </form>
  );
}
