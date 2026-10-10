'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Media from '@/components/Media';
import { AudioRecorder } from '@/components/Uploader';
import { uploadBlobs } from '@/lib/upload';
import { itemColor } from '@/lib/style';
import { Field } from '@/components/ui';
import type { EditorApi, ItemPatch } from '@/components/editor/Editor';
import type { Item } from '@/lib/types';

const MapCanvas = dynamic(() => import('@/components/MapCanvas'), { ssr: false });

/** Side drawer to edit one item: text, tags, location, timing, narration, private note. */
export default function ItemForm({ item, editor, onClose }: { item: Item; editor: EditorApi; onClose: () => void }) {
  const { channel } = editor;
  const [draft, setDraft] = useState<Item>(item);
  const [tags, setTags] = useState(item.tags.join(', '));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Item>) => setDraft((d) => ({ ...d, ...p }));
  const setMeta = (p: Partial<Item['meta']>) => setDraft((d) => ({ ...d, meta: { ...d.meta, ...p } }));
  const point = useMemo(
    () => (draft.lat != null && draft.lng != null ? [{ id: draft.id, lat: draft.lat, lng: draft.lng, color: itemColor(draft, channel.settings) }] : []),
    [draft, channel.settings],
  );

  async function save() {
    setBusy(true);
    const patch: ItemPatch = {
      id: item.id,
      title: draft.title,
      caption: draft.caption,
      tags: [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))],
      status: draft.status,
      lat: draft.lat,
      lng: draft.lng,
      audioUrl: draft.audioUrl,
      meta: draft.meta,
    };
    try {
      await editor.patchItems([patch]);
      onClose();
    } catch {
      setBusy(false);
    }
  }

  async function attachNarration(blob: Blob, name: string) {
    setBusy(true);
    try {
      const [f] = await uploadBlobs(channel.id, [{ blob, name }]);
      set({ audioUrl: f.url });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-bg p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Edit item</h2>
          <button className="btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {item.kind !== 'text' && (
          <div className="mb-4 aspect-video overflow-hidden rounded bg-black/5">
            <Media item={draft} />
          </div>
        )}
        <div className="space-y-4">
          <Field label="Title">
            <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label={item.kind === 'text' ? 'Text' : 'Caption'}>
            <textarea className="input min-h-28" value={draft.caption} onChange={(e) => set({ caption: e.target.value })} />
          </Field>
          <Field label="Tags (comma separated)">
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="water, housing, interview" />
          </Field>
          <Field label="Status">
            <select className="input" value={draft.status} onChange={(e) => set({ status: e.target.value as Item['status'] })}>
              <option value="published">Published</option>
              <option value="draft">Draft (hidden)</option>
              <option value="pending">Pending review</option>
            </select>
          </Field>

          <Field label="Location — click the map to set">
            <div className="h-56 overflow-hidden rounded border border-line">
              <MapCanvas
                points={point}
                initial={draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng, zoom: 12 } : channel.lat != null && channel.lng != null ? { lat: channel.lat, lng: channel.lng, zoom: channel.zoom ?? 8 } : null}
                cluster={false}
                styleUrl={channel.settings.mapStyle}
                onMapClick={({ lat, lng }) => set({ lat: round(lat), lng: round(lng) })}
              />
            </div>
            {draft.lat != null && (
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{draft.lat}, {draft.lng}</span>
                <button className="underline" onClick={() => set({ lat: null, lng: null })}>Remove location</button>
              </div>
            )}
          </Field>

          <details className="rounded border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">More options</summary>
            <div className="mt-3 space-y-4">
              {(item.kind === 'image' || item.kind === 'video') && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!draft.meta.is360} onChange={(e) => setMeta({ is360: e.target.checked || undefined })} />
                  360° panorama
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                {(item.kind === 'video' || item.kind === 'audio' || item.kind === 'embed') && (
                  <Field label="Start at (seconds)">
                    <input type="number" min={0} className="input" value={draft.meta.start ?? ''} onChange={(e) => setMeta({ start: num(e.target.value) })} />
                  </Field>
                )}
                <Field label="Slideshow seconds">
                  <input type="number" min={1} className="input" value={draft.meta.duration ?? ''} onChange={(e) => setMeta({ duration: num(e.target.value) })} placeholder="default" />
                </Field>
                <Field label="Caption position">
                  <select className="input" value={draft.meta.align ?? 'bottom'} onChange={(e) => setMeta({ align: e.target.value as 'top' | 'center' | 'bottom' })}>
                    <option value="bottom">Bottom</option>
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                  </select>
                </Field>
                <Field label="Story zoom">
                  <input type="number" min={1} max={20} className="input" value={draft.meta.camera?.zoom ?? ''} placeholder="auto"
                    onChange={(e) => {
                      const zoom = num(e.target.value);
                      setMeta({ camera: zoom == null ? undefined : { ...draft.meta.camera, zoom } });
                    }} />
                </Field>
              </div>
              {item.kind !== 'audio' && (
                <Field label="Narration">
                  <div className="flex flex-wrap items-center gap-2">
                    {draft.audioUrl && <audio src={draft.audioUrl} controls className="h-8" />}
                    <AudioRecorder label={draft.audioUrl ? 'Re-record' : 'Record'} onRecorded={(b) => attachNarration(b, `narration.${b.type.includes('mp4') ? 'm4a' : 'webm'}`)} />
                    <label className="btn cursor-pointer">
                      Upload audio
                      <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && attachNarration(e.target.files[0], e.target.files[0].name)} />
                    </label>
                    {draft.audioUrl && <button className="text-xs underline" onClick={() => set({ audioUrl: null })}>remove</button>}
                  </div>
                </Field>
              )}
              <Field label="Private note (never published)">
                <textarea className="input min-h-16" value={draft.meta.note ?? ''} onChange={(e) => setMeta({ note: e.target.value || undefined })} />
              </Field>
            </div>
          </details>

          <div className="flex gap-2 pt-2">
            <button className="btn-primary flex-1 py-2" onClick={save} disabled={busy}>Save</button>
            <button className="btn-danger" disabled={busy} onClick={() => confirm('Delete this item?') && editor.deleteItems([item.id]).then(onClose, () => {})}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


const num = (v: string) => (v === '' ? undefined : Number(v));
const round = (n: number) => Math.round(n * 1e6) / 1e6;
