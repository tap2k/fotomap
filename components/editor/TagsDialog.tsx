'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import type { EditorApi } from '@/components/editor/Editor';

const PALETTE = ['#e4572e', '#d9a21b', '#3d7a3a', '#1a5f7a', '#4f6bd9', '#8a4fbf', '#c2417a', '#6b6b6b'];

/** Rename (renaming onto an existing tag merges), recolor or remove tags across all items. */
export default function TagsDialog({ editor, onClose }: { editor: EditorApi; onClose: () => void }) {
  const { channel } = editor;
  const tags = useMemo(() => {
    const m = new Map<string, number>();
    channel.items.forEach((i) => i.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [channel.items]);
  const colors = channel.settings.tagColors ?? {};

  function rename(from: string, to: string | null) {
    editor.updateItems(
      channel.items.filter((i) => i.tags.includes(from)).map((i) => ({ id: i.id, tags: [...new Set(i.tags.flatMap((t) => (t === from ? (to ? [to] : []) : [t])))] })),
      { now: true },
    );
    const next = { ...colors };
    if (to && next[from] && !next[to]) next[to] = next[from];
    delete next[from];
    editor.updateSettings({ tagColors: next });
  }

  return (
    <Modal title="Tags" onClose={onClose}>
      {tags.length === 0 ? (
        <p className="text-sm text-muted">No tags yet. Add tags to items to group them, filter them and color their map markers.</p>
      ) : (
        <ul className="divide-y divide-line">
          {tags.map(([tag, count]) => (
            <TagRow
              key={tag}
              tag={tag}
              count={count}
              color={colors[tag]}
              onColor={(c) => editor.updateSettings({ tagColors: { ...colors, [tag]: c } })}
              onRename={(to) => to !== tag && rename(tag, to)}
              onDelete={() => confirm(`Remove “${tag}” from ${count} item${count === 1 ? '' : 's'}?`) && rename(tag, null)}
            />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">Tip: rename a tag to the name of another tag to merge them. Colors are used for map markers and the map legend.</p>
    </Modal>
  );
}

function TagRow({ tag, count, color, onColor, onRename, onDelete }: { tag: string; count: number; color?: string; onColor: (c: string) => void; onRename: (to: string) => void; onDelete: () => void }) {
  const [name, setName] = useState(tag);
  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1 py-1.5"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => (name.trim() ? onRename(name.trim()) : setName(tag))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label={`Rename ${tag}`}
        />
        <span className="w-16 text-right text-sm text-muted">{count} item{count === 1 ? '' : 's'}</span>
        <button className="rounded p-1.5 text-red-700 hover:bg-card" onClick={onDelete} aria-label={`Delete ${tag}`}>
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-fg' : 'border-transparent'}`}
            style={{ background: c }}
            onClick={() => onColor(c)}
            aria-label={`Color ${c}`}
          />
        ))}
        <input type="color" value={color ?? '#999999'} onChange={(e) => onColor(e.target.value)} className="h-6 w-8" aria-label="Custom color" />
      </div>
    </li>
  );
}
