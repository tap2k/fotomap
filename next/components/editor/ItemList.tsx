'use client';

import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateKeyBetween } from 'fractional-indexing';
import Media from '@/components/Media';
import ItemForm from '@/components/editor/ItemForm';
import type { EditorApi } from '@/components/editor/Editor';
import type { Item } from '@/lib/types';

/** The item table used for both curated items and the review queue. */
export default function ItemList({ editor, filter }: { editor: EditorApi; filter: 'curated' | 'pending' }) {
  const { channel } = editor;
  const [selected, setSelected] = useState<string[]>([]);
  const [tag, setTag] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const all = channel.items;
  const items = useMemo(
    () => all.filter((i) => (filter === 'pending' ? i.status === 'pending' : i.status !== 'pending') && (!tag || i.tags.includes(tag))),
    [all, filter, tag],
  );
  const allTags = useMemo(() => [...new Set(all.flatMap((i) => i.tags))].sort(), [all]);
  const editingItem = all.find((i) => i.id === editing);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const bulk = (fn: (ids: string[]) => Promise<void>) => fn(selected).then(() => setSelected([]), () => {});

  // Reorder by giving the moved item a key between its new neighbours: one row changes.
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    const rest = items.filter((i) => i.id !== active.id);
    const before = rest[to - 1]?.position ?? null;
    const after = rest[to]?.position ?? null;
    if (from === to) return;
    editor.patchItems([{ id: String(active.id), position: generateKeyBetween(before, after) }]).catch(() => {});
  }

  const setStatus = (status: Item['status']) => (ids: string[]) => editor.patchItems(ids.map((id) => ({ id, status })));
  const remove = (ids: string[]) => (confirm(`Delete ${ids.length} item${ids.length === 1 ? '' : 's'}? This can't be undone.`) ? editor.deleteItems(ids) : Promise.resolve());
  const addTag = (ids: string[]) => {
    const t = prompt('Tag to add')?.trim();
    if (!t) return Promise.resolve();
    return editor.patchItems(ids.map((id) => ({ id, tags: [...new Set([...(all.find((i) => i.id === id)?.tags ?? []), t])] })));
  };

  if (!items.length && !tag)
    return (
      <p className="py-10 text-center text-muted">
        {filter === 'pending' ? 'No submissions waiting for review. Share a submission link from the Sharing tab.' : 'No items yet — add some above.'}
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={selected.length > 0 && selected.length === items.length}
            onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])}
          />
          {selected.length ? `${selected.length} selected` : 'Select all'}
        </label>
        {selected.length > 0 && (
          <>
            {filter === 'pending' ? (
              <button className="btn-primary" onClick={() => bulk(setStatus('published'))}>Approve</button>
            ) : (
              <>
                <button className="btn" onClick={() => bulk(setStatus('published'))}>Publish</button>
                <button className="btn" onClick={() => bulk(setStatus('draft'))}>Unpublish</button>
              </>
            )}
            <button className="btn" onClick={() => bulk(addTag)}>Tag…</button>
            <button className="btn-danger" onClick={() => bulk(remove)}>Delete</button>
          </>
        )}
        {allTags.length > 0 && (
          <select className="input ml-auto w-auto" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={!!tag || filter === 'pending'}>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {items.map((item) => (
              <Row
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                onToggle={() => toggle(item.id)}
                onOpen={() => setEditing(item.id)}
                onApprove={filter === 'pending' ? () => editor.patchItems([{ id: item.id, status: 'published' }]).catch(() => {}) : undefined}
                sortable={!tag && filter !== 'pending'}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {editingItem && <ItemForm key={editingItem.id} item={editingItem} editor={editor} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Row({
  item,
  selected,
  onToggle,
  onOpen,
  onApprove,
  sortable,
}: {
  item: Item;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onApprove?: () => void;
  sortable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 bg-bg p-2 ${isDragging ? 'relative z-10 shadow-lg' : ''}`}
    >
      {sortable && (
        <button className="cursor-grab touch-none px-1 text-muted" aria-label="Drag to reorder" {...attributes} {...listeners}>
          ⠿
        </button>
      )}
      <input type="checkbox" checked={selected} onChange={onToggle} aria-label="Select" />
      <button onClick={onOpen} className="h-14 w-14 shrink-0 overflow-hidden rounded bg-card">
        <Media item={item} mode="thumb" fit="cover" />
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium">{item.title || item.caption.slice(0, 80) || <span className="text-muted">Untitled {item.kind}</span>}</div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {item.status !== 'published' && <span className="chip border-amber-500 text-amber-700">{item.status}</span>}
          {item.lat != null && <span title="Has location">📍</span>}
          {item.meta.is360 && <span className="chip">360°</span>}
          {item.meta.contributor?.name && <span>by {item.meta.contributor.name}</span>}
          {item.tags.map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
      </button>
      {onApprove && (
        <button className="btn-primary" onClick={onApprove}>
          Approve
        </button>
      )}
    </li>
  );
}
