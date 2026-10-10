'use client';

import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateKeyBetween } from 'fractional-indexing';
import { Check, EyeOff, Headphones, MapPinOff, Orbit, Tags, Trash2, Eye, ImagePlus, Users, Share2 } from 'lucide-react';
import Media from '@/components/Media';
import Uploader from '@/components/Uploader';
import TagsDialog from '@/components/editor/TagsDialog';
import type { EditorApi } from '@/components/editor/Editor';
import type { Item } from '@/lib/types';

type Filter = { type: 'all' } | { type: 'drafts' } | { type: 'unplaced' } | { type: 'tag'; tag: string };

export default function ContentTab({ editor }: { editor: EditorApi }) {
  const { channel } = editor;
  const [filter, setFilter] = useState<Filter>({ type: 'all' });
  const [selected, setSelected] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [bulkTag, setBulkTag] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const content = useMemo(() => channel.items.filter((i) => i.status !== 'pending'), [channel.items]);
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    content.forEach((i) => i.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [content]);
  const drafts = content.filter((i) => i.status === 'draft').length;
  const unplaced = content.filter((i) => i.lat == null && i.kind !== 'text').length;
  const shown = useMemo(
    () =>
      content.filter((i) =>
        filter.type === 'drafts' ? i.status === 'draft' : filter.type === 'unplaced' ? i.lat == null && i.kind !== 'text' : filter.type === 'tag' ? i.tags.includes(filter.tag) : true,
      ),
    [content, filter],
  );
  const sortable = filter.type === 'all';

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const to = shown.findIndex((i) => i.id === over.id);
    const rest = shown.filter((i) => i.id !== active.id);
    editor.updateItems([{ id: String(active.id), position: generateKeyBetween(rest[to - 1]?.position ?? null, rest[to]?.position ?? null) }], { now: true });
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const bulk = (patch: (i: Item) => Partial<Item>) => {
    editor.updateItems(selected.map((id) => ({ id, ...patch(channel.items.find((i) => i.id === id)!) })), { now: true });
    setSelected([]);
  };

  const chip = (active: boolean) => `chip cursor-pointer py-1 text-sm ${active ? 'border-accent bg-accent text-accent-fg' : 'hover:bg-card'}`;

  return (
    <div className="space-y-4">
      {content.length === 0 && <GettingStarted editor={editor} />}
      <Uploader channelId={channel.id} onAdd={editor.addItems} compact={content.length > 0} />

      {content.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button className={chip(filter.type === 'all')} onClick={() => setFilter({ type: 'all' })}>
            All {content.length}
          </button>
          {drafts > 0 && (
            <button className={chip(filter.type === 'drafts')} onClick={() => setFilter({ type: 'drafts' })}>
              <EyeOff size={12} /> Hidden {drafts}
            </button>
          )}
          {unplaced > 0 && (
            <button className={chip(filter.type === 'unplaced')} onClick={() => setFilter({ type: 'unplaced' })} title="Items not on the map yet">
              <MapPinOff size={12} /> No location {unplaced}
            </button>
          )}
          {tagCounts.map(([t, n]) => (
            <button key={t} className={chip(filter.type === 'tag' && filter.tag === t)} onClick={() => setFilter({ type: 'tag', tag: t })}>
              {channel.settings.tagColors?.[t] && <span className="h-2 w-2 rounded-full" style={{ background: channel.settings.tagColors[t] }} />}
              {t} {n}
            </button>
          ))}
          <button className="chip cursor-pointer py-1 text-sm text-muted hover:bg-card" onClick={() => setTagsOpen(true)}>
            <Tags size={12} /> Manage tags
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="sticky top-[6.5rem] z-20 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg p-2 shadow-md">
          <span className="px-1 text-sm font-medium">{selected.length} selected</span>
          <button className="btn" onClick={() => bulk(() => ({ status: 'published' }))}>
            <Eye size={14} /> Show
          </button>
          <button className="btn" onClick={() => bulk(() => ({ status: 'draft' }))}>
            <EyeOff size={14} /> Hide
          </button>
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const t = bulkTag.trim();
              if (t) bulk((i) => ({ tags: [...new Set([...i.tags, t])] }));
              setBulkTag('');
            }}
          >
            <input className="input w-32 py-1.5" placeholder="Add tag…" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} list="tag-list" />
            <datalist id="tag-list">{tagCounts.map(([t]) => <option key={t} value={t} />)}</datalist>
          </form>
          <button
            className="btn text-red-700"
            onClick={() => confirm(`Delete ${selected.length} item${selected.length === 1 ? '' : 's'}? This can't be undone.`) && editor.deleteItems(selected).then(() => setSelected([]), () => {})}
          >
            <Trash2 size={14} /> Delete
          </button>
          <button className="ml-auto text-sm text-muted underline" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}

      {filter.type === 'unplaced' && shown.length > 0 && (
        <p className="rounded-lg bg-card p-3 text-sm">These aren’t on the map yet. Open each one and search for the place, or click the map to set it.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((i) => i.id)} strategy={rectSortingStrategy} disabled={!sortable}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {shown.map((item) => (
              <Card key={item.id} item={item} selected={selected.includes(item.id)} selecting={selected.length > 0} onToggle={() => toggle(item.id)} onOpen={() => editor.openItem(item.id)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {sortable && content.length > 1 && <p className="text-center text-xs text-muted">Drag to reorder. The order is used by the slideshow and the story.</p>}

      {tagsOpen && <TagsDialog editor={editor} onClose={() => setTagsOpen(false)} />}
    </div>
  );
}

function Card({ item, selected, selecting, onToggle, onOpen }: { item: Item; selected: boolean; selecting: boolean; onToggle: () => void; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative overflow-hidden rounded-xl border bg-bg ${selected ? 'border-accent ring-2 ring-accent' : 'border-line'} ${isDragging ? 'z-10 shadow-xl' : ''}`}
      {...attributes}
      {...listeners}
    >
      <button className="block w-full text-left" onClick={selecting ? onToggle : onOpen}>
        <div className={`aspect-square bg-card ${item.status === 'draft' ? 'opacity-50' : ''}`}>
          <Media item={item} mode="thumb" fit="cover" />
        </div>
        <div className="truncate px-2 py-1.5 text-sm">{item.title || <span className="text-muted">{item.caption.slice(0, 40) || 'Untitled'}</span>}</div>
      </button>
      <div className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1">
        {item.status === 'draft' && <Badge title="Hidden from viewers"><EyeOff size={12} /></Badge>}
        {item.lat == null && item.kind !== 'text' && <Badge title="No location"><MapPinOff size={12} /></Badge>}
        {item.meta.is360 && <Badge title="360°"><Orbit size={12} /></Badge>}
        {item.audioUrl && <Badge title="Has voice-over"><Headphones size={12} /></Badge>}
      </div>
      <button
        onClick={onToggle}
        className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow transition ${selected ? 'bg-accent text-accent-fg' : 'bg-black/30 text-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100'} ${selecting ? 'sm:opacity-100' : ''}`}
        aria-label={selected ? 'Deselect' : 'Select'}
      >
        <Check size={14} />
      </button>
    </li>
  );
}

const Badge = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <span title={title} className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
    {children}
  </span>
);

function GettingStarted({ editor }: { editor: EditorApi }) {
  const steps = [
    { Icon: ImagePlus, title: 'Add your media', text: 'Drop photos, videos or audio below. Locations are read from photos automatically.' },
    { Icon: Users, title: 'Collect from others', text: 'Get a link or QR code so participants can contribute from their phones.', action: () => editor.goTo('collect'), cta: 'Set up' },
    { Icon: Share2, title: 'Share it', text: 'Publish as a map, slideshow, grid or story — or embed it on a website.', action: () => editor.goTo('design'), cta: 'Design' },
  ];
  return (
    <div className="space-y-2">
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map(({ Icon, title, text, action, cta }, i) => (
        <div key={title} className="card flex flex-col gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm text-accent-fg">{i + 1}</span>
            <Icon size={18} className="text-muted" /> {title}
          </div>
          <p className="flex-1 text-sm text-muted">{text}</p>
          {action && (
            <button className="btn self-start" onClick={action}>
              {cta}
            </button>
          )}
        </div>
      ))}
    </div>
    <p className="text-sm text-muted">
      New here? <a href="/guide" target="_blank" className="text-accent underline">Watch the 2-minute guide</a>.
    </p>
    </div>
  );
}
