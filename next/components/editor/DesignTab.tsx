'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, Music, Trash2, Upload } from 'lucide-react';
import { prepareFile, uploadBlobs } from '@/lib/upload';
import { DEFAULT_MARKER, MAP_STYLE } from '@/lib/style';
import { THEMES, type ChannelSettings } from '@/lib/types';
import { Field, Section } from '@/components/ui';
import PlaceSearch from '@/components/PlaceSearch';
import { VIEW_LABELS } from '@/components/viewMeta';
import { useToast } from '@/components/Toast';
import type { EditorApi } from '@/components/editor/Editor';

const MapCanvas = dynamic(() => import('@/components/MapCanvas'), { ssr: false });

// [background, accent, text] — must match the themes in globals.css.
const THEME_SWATCH: Record<(typeof THEMES)[number], [string, string, string]> = {
  light: ['#ffffff', '#1a5f7a', '#1d2327'],
  dark: ['#121417', '#5fb3d3', '#eceff1'],
  paper: ['#f7f3ea', '#a4462b', '#2b2620'],
  ocean: ['#0d2233', '#4fd1c5', '#e6f1f7'],
  forest: ['#f2f5ef', '#3d7a3a', '#1f2a1e'],
  sunset: ['#fff6ef', '#d9542b', '#2d1c17'],
};

const BASEMAPS = [
  { name: 'Streets', url: MAP_STYLE },
  { name: 'Light', url: 'https://tiles.openfreemap.org/styles/positron' },
  { name: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  { name: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark' },
];

const MARKERS = ['#e4572e', '#d9a21b', '#3d7a3a', '#1a5f7a', '#4f6bd9', '#8a4fbf', '#c2417a', '#1d2327'];

export default function DesignTab({ editor }: { editor: EditorApi }) {
  const { channel } = editor;
  const s = channel.settings;
  const set = editor.updateSettings;
  const toast = useToast();
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const isPreset = !s.mapStyle || BASEMAPS.some((b) => b.url === s.mapStyle);
  const [custom, setCustom] = useState(!isPreset);

  async function upload(file: File) {
    try {
      const blob = file.type.startsWith('image/') && file.type !== 'image/gif' ? (await prepareFile(file)).main : { blob: file, name: file.name };
      return (await uploadBlobs(channel.id, [blob]))[0].url;
    } catch (e) {
      toast((e as Error).message, 'error');
      throw e;
    }
  }

  // The chosen center (dark) plus the project's items (grey), so the map opens where the content is.
  const center = useMemo(
    () => [
      ...channel.items.filter((i) => i.lat != null && i.lng != null).map((i) => ({ id: i.id, lat: i.lat!, lng: i.lng!, color: '#9aa4ad' })),
      ...(channel.lat != null && channel.lng != null ? [{ id: 'center', lat: channel.lat, lng: channel.lng, color: '#1d2327', isChannel: true }] : []),
    ],
    [channel.items, channel.lat, channel.lng],
  );

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      <Section title="Opens as">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VIEW_LABELS.map(({ view, label, hint, Icon }) => {
            const active = (s.defaultView ?? 'map') === view;
            return (
              <button key={view} onClick={() => set({ defaultView: view })} className={`card p-3 text-left ${active ? 'border-accent ring-2 ring-accent' : 'hover:bg-card'}`}>
                <Icon size={20} />
                <span className="mt-1 block font-medium">{label}</span>
                <span className="text-xs text-muted">{hint}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">Visitors can always switch between views.</p>
      </Section>

      <Section title="Theme">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {THEMES.map((t) => {
            const [bg, accent, fg] = THEME_SWATCH[t];
            const active = (s.theme ?? 'light') === t;
            return (
              <button key={t} onClick={() => set({ theme: t })} className={`overflow-hidden rounded-xl border text-left ${active ? 'border-accent ring-2 ring-accent' : 'border-line'}`} aria-pressed={active}>
                <div className="flex h-14 flex-col justify-end gap-1 p-2" style={{ background: bg }}>
                  <div className="h-1.5 w-3/4 rounded" style={{ background: fg, opacity: 0.8 }} />
                  <div className="h-3 w-1/2 rounded" style={{ background: accent }} />
                </div>
                <div className="flex items-center justify-between px-2 py-1 text-xs capitalize">
                  {t} {active && <Check size={12} />}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Cover & description">
        <Field label="Description">
          <textarea className="input min-h-20" value={channel.description} placeholder="A sentence or two about the project, shown on the story title and when sharing." onChange={(e) => editor.updateChannel({ description: e.target.value })} />
        </Field>
        <Field label="Cover image">
          <FilePick accept="image/*" url={s.coverUrl} onPick={async (f) => set({ coverUrl: await upload(f) })} onClear={() => set({ coverUrl: undefined })} />
        </Field>
      </Section>

      <Section title="Map">
        <Field label="Base map">
          <div className="flex flex-wrap gap-2">
            {BASEMAPS.map((b) => {
              const active = !custom && (s.mapStyle ?? MAP_STYLE) === b.url;
              return (
                <button key={b.name} className={active ? 'btn-primary' : 'btn'} onClick={() => { setCustom(false); set({ mapStyle: b.url === MAP_STYLE ? undefined : b.url, mapAttribution: undefined }); }}>
                  {b.name}
                </button>
              );
            })}
            <button className={custom ? 'btn-primary' : 'btn'} onClick={() => setCustom(true)}>
              Custom…
            </button>
          </div>
          {custom && (
            <input
              className="input mt-2"
              placeholder="MapLibre style URL, or tiles like https://…/{z}/{x}/{y}.png"
              defaultValue={isPreset ? '' : s.mapStyle}
              onBlur={(e) => e.target.value && set({ mapStyle: e.target.value })}
            />
          )}
        </Field>

        <Field label="Marker color">
          <div className="flex flex-wrap items-center gap-1.5">
            {MARKERS.map((c) => (
              <button key={c} className={`h-7 w-7 rounded-full border-2 ${(s.markerColor ?? DEFAULT_MARKER) === c ? 'border-fg' : 'border-transparent'}`} style={{ background: c }} onClick={() => set({ markerColor: c })} aria-label={`Marker color ${c}`} />
            ))}
            <input type="color" value={s.markerColor ?? DEFAULT_MARKER} onChange={(e) => set({ markerColor: e.target.value })} className="h-7 w-9" aria-label="Custom marker color" />
            <span className="ml-2 text-xs text-muted">Tag colors (Content → Manage tags) take priority.</span>
          </div>
        </Field>

        <Field label="Starting view">
          <div className="space-y-2">
            <p className="text-xs text-muted">By default the map zooms to fit everything. To start somewhere specific, search or click the map.</p>
            <PlaceSearch
              onPick={(p) => {
                editor.updateChannel({ lat: p.lat, lng: p.lng, zoom: channel.zoom ?? 12 });
                setFocus({ lat: p.lat, lng: p.lng, zoom: channel.zoom ?? 12 });
              }}
            />
            <div className="h-60 overflow-hidden rounded-lg border border-line">
              <MapCanvas
                points={center}
                cluster={false}
                mapSettings={s}
                focus={focus}
                initial={channel.lat != null && channel.lng != null ? { lat: channel.lat, lng: channel.lng, zoom: channel.zoom ?? 10 } : null}
                onMapClick={({ lat, lng }) => editor.updateChannel({ lat: +lat.toFixed(5), lng: +lng.toFixed(5), zoom: channel.zoom ?? 10 })}
              />
            </div>
            {channel.lat != null && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  Zoom
                  <input type="range" min={2} max={18} value={channel.zoom ?? 10} onChange={(e) => editor.updateChannel({ zoom: Number(e.target.value) })} />
                  <span className="w-6 text-muted">{channel.zoom ?? 10}</span>
                </label>
                <button className="underline" onClick={() => editor.updateChannel({ lat: null, lng: null, zoom: null })}>
                  Fit to everything instead
                </button>
              </div>
            )}
          </div>
        </Field>

        <Overlays settings={s} set={set} center={{ lat: channel.lat, lng: channel.lng }} upload={upload} />
      </Section>

      <Section title="Slideshow">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Seconds per photo: ${s.interval ?? 5}`}>
            <input type="range" min={2} max={30} value={s.interval ?? 5} onChange={(e) => set({ interval: Number(e.target.value) })} className="w-full" />
          </Field>
          <Field label="Background music">
            <FilePick accept="audio/*" url={s.audioUrl} audio onPick={async (f) => set({ audioUrl: await upload(f) })} onClear={() => set({ audioUrl: undefined })} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function Overlays({ settings, set, center, upload }: { settings: ChannelSettings; set: (p: Partial<ChannelSettings>) => void; center: { lat: number | null; lng: number | null }; upload: (f: File) => Promise<string> }) {
  const overlays = settings.overlays ?? [];
  const update = (i: number, p: Partial<(typeof overlays)[number]>) => set({ overlays: overlays.map((o, j) => (j === i ? { ...o, ...p } : o)) });
  const names = ['Top left', 'Top right', 'Bottom right', 'Bottom left'];
  return (
    <Field label="Image overlays">
      <p className="mb-2 text-xs text-muted">Lay a historic map, plan or drawing over the base map by giving its four corners.</p>
      {overlays.map((o, i) => (
        <details key={i} className="mb-2 rounded-lg border border-line p-2 text-xs">
          <summary className="flex cursor-pointer items-center gap-2">
            <img src={o.url} alt="" className="h-8 w-8 rounded object-cover" />
            <span className="flex-1">Overlay {i + 1}</span>
            <label className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              Opacity
              <input type="range" min={0} max={1} step={0.05} value={o.opacity} onChange={(e) => update(i, { opacity: Number(e.target.value) })} />
            </label>
            <button className="p-1 text-red-700" onClick={() => set({ overlays: overlays.filter((_, j) => j !== i) })} aria-label="Remove overlay">
              <Trash2 size={14} />
            </button>
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {o.corners.map((c, k) => (
              <div key={k}>
                <div className="text-muted">{names[k]} (lat, lng)</div>
                <div className="flex gap-1">
                  {(['lat', 'lng'] as const).map((axis) => (
                    <input
                      key={axis}
                      type="number"
                      step="any"
                      className="input px-1 py-1 text-xs"
                      value={c[axis]}
                      onChange={(e) => update(i, { corners: o.corners.map((cc, kk) => (kk === k ? { ...cc, [axis]: Number(e.target.value) } : cc)) as typeof o.corners })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
      <label className="btn cursor-pointer">
        <Upload size={14} /> Add overlay image
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = await upload(file);
            const lat = center.lat ?? 0;
            const lng = center.lng ?? 0;
            const d = 0.02;
            set({ overlays: [...overlays, { url, opacity: 0.8, corners: [{ lat: lat + d, lng: lng - d }, { lat: lat + d, lng: lng + d }, { lat: lat - d, lng: lng + d }, { lat: lat - d, lng: lng - d }] }] });
          }}
        />
      </label>
    </Field>
  );
}

function FilePick({ accept, url, audio, onPick, onClear }: { accept: string; url?: string; audio?: boolean; onPick: (f: File) => Promise<void>; onClear: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url && (audio ? <audio src={url} controls className="h-9 max-w-full" /> : <img src={url} alt="" className="h-16 rounded-lg object-cover" />)}
      <label className="btn cursor-pointer">
        {audio ? <Music size={14} /> : <Upload size={14} />}
        {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        <input
          type="file"
          accept={accept}
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            await onPick(f).catch(() => {});
            setBusy(false);
          }}
        />
      </label>
      {url && (
        <button className="text-xs underline" onClick={onClear}>
          Remove
        </button>
      )}
    </div>
  );
}
