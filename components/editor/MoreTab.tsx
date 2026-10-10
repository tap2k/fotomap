'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { Section } from '@/components/ui';
import NewChannel from '@/components/NewChannel';
import ExportPanel from '@/components/editor/ExportPanel';
import { useToast } from '@/components/Toast';
import type { EditorApi } from '@/components/editor/Editor';

export default function MoreTab({ editor }: { editor: EditorApi }) {
  const { channel, isOwner } = editor;
  return (
    <div className="max-w-3xl space-y-8">
      <Section title="Sub-projects">
        <p className="text-sm text-muted">Split a big project into parts (e.g. one per neighbourhood or workshop). They appear as markers on this project’s map, and people with access here can edit them too.</p>
        {channel.children.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {channel.children.map((c) => (
              <li key={c.id}>
                <Link className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-card" href={`/edit/${c.id}`}>
                  <FolderOpen size={16} className="text-muted" /> {c.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <NewChannel parentId={channel.id} label="Add sub-project" placeholder="Sub-project title" />
      </Section>

      <Section title="Export">
        <ExportPanel channel={channel} />
      </Section>

      {isOwner && <DeleteProject id={channel.id} title={channel.title} />}
    </div>
  );
}

function DeleteProject({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  return (
    <Section title="Delete project">
      <p className="text-sm text-muted">This permanently deletes the project, its sub-projects and every uploaded file. Export first if you might need anything.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input" placeholder={`Type “${title}” to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} />
        <button
          className="btn-danger shrink-0"
          disabled={typed !== title}
          onClick={async () => {
            try {
              await api(`/api/channels/${id}`, { method: 'DELETE' });
              router.push('/');
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          }}
        >
          Delete forever
        </button>
      </div>
    </Section>
  );
}
