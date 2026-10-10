'use client';

import { Check, Inbox, MapPin, Pencil, X } from 'lucide-react';
import Media from '@/components/Media';
import Text from '@/components/Text';
import type { EditorApi } from '@/components/editor/Editor';

/** Contributions waiting for review: approve, edit first, or reject. */
export default function InboxTab({ editor }: { editor: EditorApi }) {
  const pending = editor.channel.items.filter((i) => i.status === 'pending');
  const approve = (ids: string[]) => editor.updateItems(ids.map((id) => ({ id, status: 'published' as const })), { now: true });

  if (!pending.length)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Inbox size={40} className="text-muted" />
        <p className="font-medium">No contributions waiting</p>
        <p className="max-w-sm text-sm text-muted">When people send something through your contribution link, it lands here for you to approve before anyone else sees it.</p>
        <button className="btn" onClick={() => editor.goTo('collect')}>
          Set up contributions
        </button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {pending.length} contribution{pending.length === 1 ? '' : 's'} waiting. Nothing here is public until you approve it.
        </p>
        {pending.length > 1 && (
          <button className="btn" onClick={() => confirm(`Approve all ${pending.length}?`) && approve(pending.map((i) => i.id))}>
            <Check size={16} /> Approve all
          </button>
        )}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pending.map((item) => (
          <li key={item.id} className="card flex flex-col gap-3 p-3">
            {item.kind !== 'text' && (
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-black/5">
                <Media item={item} />
              </div>
            )}
            <div className="flex-1 space-y-1">
              {item.title && <p className="font-medium">{item.title}</p>}
              <Text text={item.caption} className="text-sm" />
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {item.meta.contributor?.name && <span>by {item.meta.contributor.name}</span>}
                {item.lat != null ? (
                  <span className="flex items-center gap-0.5">
                    <MapPin size={12} /> located
                  </span>
                ) : (
                  <span>no location</span>
                )}
                {item.meta.contributor?.consent && <span>· consent given</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={() => approve([item.id])}>
                <Check size={16} /> Approve
              </button>
              <button className="btn" onClick={() => editor.openItem(item.id)} aria-label="Edit first">
                <Pencil size={16} />
              </button>
              <button className="btn text-red-700" onClick={() => confirm('Reject and delete this contribution?') && editor.deleteItems([item.id]).catch(() => {})} aria-label="Reject">
                <X size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
