'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, ChevronLeft, ChevronRight, MapPin, Mic, Trash2, Upload, X } from 'lucide-react';
import Media from '@/components/Media';
import PlaceSearch from '@/components/PlaceSearch';
import TagInput from '@/components/editor/TagInput';
import { AudioRecorder } from '@/components/Uploader';
import { Field } from '@/components/ui';
import { uploadBlobs } from '@/lib/upload';
import { itemColor } from '@/lib/style';
import { useToast } from '@/components/Toast';
import type { EditorApi, ItemPatch } from '@/components/editor/Editor';
import type { Item } from '@/lib/types';

const MapCanvas = dynamic(() => import('@/components/MapCanvas'), { ssr: false });

/** Side drawer for one item. Every change saves automatically. */
export default function ItemPanel({ item, editor, onClose }: { item: Item; editor: EditorApi; onClose: () => void }) {
  const { channel } = editor;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const set = (p: Omit<ItemPatch, 'id'>, now = false) => editor.updateItems([{ id: item.id, ...p }], { now });
  const setMeta = (p: Partial<Item['meta']>) => set({ meta: { ...item.meta, ...p } });

  // Arrow through items of the same kind of list (inbox or content) without closing.
  const siblings = useMemo(() => channel.items.filter((i) => (i.status === 'pending') === (item.status === 'pending')), [channel.items, item.status]);
  const index = siblings.findIndex((i) => i.id === item.id);
  const go = (d: number) => siblings[index + d] && editor.openItem(siblings[index + d].id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const allTags = useMemo(() => [...new Set(channel.items.flatMap((i) => i.tags))].sort(), [channel.items]);
  const point = useMemo(
    () => (item.lat != null && item.lng != null ? [{ id: item.id, lat: item.lat, lng: item.lng, color: itemColor(item, channel.settings) }] : []),
    [item, channel.settings],
  );
  const start = item.lat != null && item.lng != null ? { lat: item.lat, lng: item.lng, zoom: 13 } : channel.lat != null && channel.lng != null ? { lat: channel.lat, lng: channel.lng, zoom: channel.zoom ?? 8 } : null;

  async function attachNarration(blob: Blob, name: string) {
    setBusy(true);
    try {
      const [f] = await uploadBlobs(channel.id, [{ blob, name }]);
      set({ audioUrl: f.url }, true);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const placeAt = (lat: number, lng: number) => set({ lat: round(lat), lng: round(lng) }, true);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="fade-in flex h-full w-full max-w-xl flex-col bg-bg shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label="Edit item">
        <div className="flex items-center gap-1 border-b border-line px-3 py-2">
          <button className="rounded p-1.5 hover:bg-card disabled:opacity-30" onClick={() => go(-1)} disabled={index <= 0} aria-label="Previous item">
            <ChevronLeft size={18} />
          </button>
          <button className="rounded p-1.5 hover:bg-card disabled:opacity-30" onClick={() => go(1)} disabled={index >= siblings.length - 1} aria-label="Next item">
            <ChevronRight size={18} />
          </button>
          <span className="flex-1 text-sm text-muted">
            {index + 1} of {siblings.length}
          </span>
          {item.status === 'pending' ? (
            <button className="btn-primary" onClick={() => set({ status: 'published' }, true)}>
              <Check size={16} /> Approve
            </button>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={item.status === 'published'} onChange={(e) => set({ status: e.target.checked ? 'published' : 'draft' }, true)} />
              Visible
            </label>
          )}
          <button className="ml-2 rounded p-1.5 hover:bg-card" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {item.kind !== 'text' && (
            <div className="aspect-video overflow-hidden rounded-lg bg-black/5">
              <Media item={item} />
            </div>
          )}
          {item.meta.contributor?.name && <p className="text-sm text-muted">Contributed by {item.meta.contributor.name}</p>}

          <Field label="Title">
            <input className="input text-base" value={item.title} placeholder="Give it a title" onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={item.kind === 'text' ? 'Text' : 'Caption'}>
            <textarea className="input min-h-28 text-base" value={item.caption} placeholder="What does it show? Why does it matter?" onChange={(e) => set({ caption: e.target.value })} />
          </Field>
          <Field label="Tags">
            <TagInput value={item.tags} onChange={(tags) => set({ tags }, true)} suggestions={allTags} colors={channel.settings.tagColors} />
          </Field>

          <Field label="Location">
            <div className="space-y-2">
              <PlaceSearch
                onPick={(p) => {
                  placeAt(p.lat, p.lng);
                  setFocus({ lat: p.lat, lng: p.lng, zoom: 15 });
                }}
              />
              <div className="relative h-56 overflow-hidden rounded-lg border border-line">
                <MapCanvas points={point} initial={start} focus={focus} cluster={false} mapSettings={channel.settings} onMapClick={({ lat, lng }) => placeAt(lat, lng)} />
                {item.lat == null && (
                  <div className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded bg-bg/90 px-2 py-1 text-xs shadow">Click the map to place it</div>
                )}
              </div>
              {item.lat != null && (
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {item.lat.toFixed(5)}, {item.lng?.toFixed(5)}
                  </span>
                  <button className="underline" onClick={() => set({ lat: null, lng: null }, true)}>
                    Remove location
                  </button>
                </div>
              )}
            </div>
          </Field>

          {item.kind !== 'audio' && (
            <Field label="Voice-over">
              <div className="flex flex-wrap items-center gap-2">
                {item.audioUrl && <audio src={item.audioUrl} controls className="h-9 max-w-full" />}
                <AudioRecorder label={item.audioUrl ? 'Re-record' : 'Record'} onRecorded={(b) => attachNarration(b, `narration.${b.type.includes('mp4') ? 'm4a' : 'webm'}`)} />
                <label className="btn cursor-pointer">
                  <Upload size={14} /> Upload
                  <input type="file" accept="audio/*" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && attachNarration(e.target.files[0], e.target.files[0].name)} />
                </label>
                {item.audioUrl && (
                  <button className="text-xs underline" onClick={() => set({ audioUrl: null }, true)}>
                    remove
                  </button>
                )}
                {!item.audioUrl && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Mic size={12} /> Plays with this item in the slideshow
                  </span>
                )}
              </div>
            </Field>
          )}

          <Field label="Private note">
            <textarea className="input min-h-16" value={item.meta.note ?? ''} placeholder="Only editors see this (coding notes, follow-ups…)" onChange={(e) => setMeta({ note: e.target.value || undefined })} />
          </Field>

          <details className="rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">More options</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(item.kind === 'image' || item.kind === 'video') && (
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!item.meta.is360} onChange={(e) => setMeta({ is360: e.target.checked || undefined })} />
                  360° panorama
                </label>
              )}
              {(item.kind === 'video' || item.kind === 'audio' || item.kind === 'embed') && (
                <Field label="Start at (seconds)">
                  <input type="number" min={0} className="input" value={item.meta.start ?? ''} onChange={(e) => setMeta({ start: num(e.target.value) })} />
                </Field>
              )}
              <Field label="Slideshow seconds">
                <input type="number" min={1} className="input" value={item.meta.duration ?? ''} placeholder="Default" onChange={(e) => setMeta({ duration: num(e.target.value) })} />
              </Field>
              <Field label="Caption position">
                <select className="input" value={item.meta.align ?? 'bottom'} onChange={(e) => setMeta({ align: e.target.value as 'top' | 'center' | 'bottom' })}>
                  <option value="bottom">Bottom</option>
                  <option value="center">Middle</option>
                  <option value="top">Top</option>
                </select>
              </Field>
              <Field label="Story map zoom">
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="input"
                  value={item.meta.camera?.zoom ?? ''}
                  placeholder="Auto"
                  onChange={(e) => {
                    const zoom = num(e.target.value);
                    setMeta({ camera: zoom == null ? undefined : { ...item.meta.camera, zoom } });
                  }}
                />
              </Field>
            </div>
          </details>
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <button
            className="flex items-center gap-1.5 text-sm text-red-700 hover:underline"
            onClick={() => confirm(item.status === 'pending' ? 'Reject and delete this contribution?' : 'Delete this item?') && editor.deleteItems([item.id]).catch(() => {})}
          >
            <Trash2 size={16} /> {item.status === 'pending' ? 'Reject' : 'Delete'}
          </button>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}

const num = (v: string) => (v === '' ? undefined : Number(v));
const round = (n: number) => Math.round(n * 1e6) / 1e6;
