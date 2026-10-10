'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { prepareFile, uploadBlobs } from '@/lib/upload';
import { DEFAULT_MARKER } from '@/lib/style';
import { THEMES, VIEWS, type Channel, type ChannelSettings } from '@/lib/types';
import NewChannel from '@/components/NewChannel';
import { Field, Section } from '@/components/ui';
import type { EditorApi } from '@/components/editor/Editor';

const MapCanvas = dynamic(() => import('@/components/MapCanvas'), { ssr: false });

type Basics = Pick<Channel, 'title' | 'description' | 'visibility' | 'lat' | 'lng' | 'zoom'>;

export default function SettingsForm({ editor, isOwner, videoEnabled, signedIn }: { editor: EditorApi; isOwner: boolean; videoEnabled: boolean; signedIn: boolean }) {
  const { channel } = editor;
  const router = useRouter();
  const [basics, setBasics] = useState<Basics>({
    title: channel.title,
    description: channel.description,
    visibility: channel.visibility,
    lat: channel.lat,
    lng: channel.lng,
    zoom: channel.zoom,
  });
  const [settings, setSettings] = useState<ChannelSettings>(channel.settings);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<ChannelSettings>) => setSettings((s) => ({ ...s, ...p }));
  const sub = settings.submissions ?? {};
  const setSub = (p: Partial<NonNullable<ChannelSettings['submissions']>>) => set({ submissions: { ...sub, ...p } });

  async function save() {
    setBusy(true);
    try {
      await editor.saveChannel({ ...(isOwner ? basics : { ...basics, visibility: undefined }), settings: clean(settings) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* shown by the editor */
    } finally {
      setBusy(false);
    }
  }

  async function uploadOne(file: File): Promise<string> {
    const blob = file.type.startsWith('image/') && file.type !== 'image/gif' ? (await prepareFile(file)).main : { blob: file, name: file.name };
    const [f] = await uploadBlobs(channel.id, [blob]);
    return f.url;
  }

  const centerPoint = useMemo(
    () => (basics.lat != null && basics.lng != null ? [{ id: 'center', lat: basics.lat, lng: basics.lng, color: '#1d2327' }] : []),
    [basics.lat, basics.lng],
  );

  return (
    <div className="space-y-8 pb-24">
      <Section title="Basics">
        <Field label="Title">
          <input className="input" value={basics.title} onChange={(e) => setBasics({ ...basics, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-24" value={basics.description} onChange={(e) => setBasics({ ...basics, description: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          {isOwner && (
            <Field label="Who can view">
              <select className="input" value={basics.visibility} onChange={(e) => setBasics({ ...basics, visibility: e.target.value as Basics['visibility'] })}>
                <option value="private">Private — members and view links only</option>
                <option value="unlisted">Unlisted — anyone with the link</option>
                <option value="public">Public — listed on the home page</option>
              </select>
            </Field>
          )}
          <Field label="Opens as">
            <select className="input" value={settings.defaultView ?? 'map'} onChange={(e) => set({ defaultView: e.target.value as ChannelSettings['defaultView'] })}>
              {VIEWS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Theme">
            <select className="input" value={settings.theme ?? 'light'} onChange={(e) => set({ theme: e.target.value as ChannelSettings['theme'] })}>
              {THEMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Cover image">
          <FilePick accept="image/*" url={settings.coverUrl} onPick={async (f) => set({ coverUrl: await uploadOne(f) })} onClear={() => set({ coverUrl: undefined })} />
        </Field>
      </Section>

      <Section title="Map">
        <Field label="Starting view — click to set the center (leave empty to fit all items)">
          <div className="h-56 overflow-hidden rounded border border-line">
            <MapCanvas
              points={centerPoint}
              cluster={false}
              styleUrl={settings.mapStyle}
              overlays={settings.overlays}
              initial={basics.lat != null && basics.lng != null ? { lat: basics.lat, lng: basics.lng, zoom: basics.zoom ?? 8 } : null}
              onMapClick={({ lat, lng }) => setBasics({ ...basics, lat: +lat.toFixed(5), lng: +lng.toFixed(5), zoom: basics.zoom ?? 10 })}
            />
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              Zoom
              <input type="number" min={1} max={20} className="input w-20" value={basics.zoom ?? ''} onChange={(e) => setBasics({ ...basics, zoom: e.target.value ? Number(e.target.value) : null })} />
            </label>
            {basics.lat != null && (
              <button className="underline" onClick={() => setBasics({ ...basics, lat: null, lng: null, zoom: null })}>
                Clear
              </button>
            )}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Marker color">
            <input type="color" value={settings.markerColor ?? DEFAULT_MARKER} onChange={(e) => set({ markerColor: e.target.value })} className="h-9 w-16" />
          </Field>
          <Field label="Map style URL (MapLibre style JSON)">
            <input className="input" placeholder="Default: OpenFreeMap" value={settings.mapStyle ?? ''} onChange={(e) => set({ mapStyle: e.target.value || undefined })} />
          </Field>
        </div>
        <Overlays settings={settings} set={set} center={basics} upload={uploadOne} />
      </Section>

      <Section title="Tags">
        <TagManager editor={editor} settings={settings} set={set} />
      </Section>

      <Section title="Slideshow">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seconds per photo">
            <input type="number" min={1} max={120} className="input" value={settings.interval ?? ''} placeholder="5" onChange={(e) => set({ interval: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Background music">
            <FilePick accept="audio/*" url={settings.audioUrl} audio onPick={async (f) => set({ audioUrl: await uploadOne(f) })} onClear={() => set({ audioUrl: undefined })} />
          </Field>
        </div>
      </Section>

      <Section title="Submissions">
        <p className="text-sm text-muted">Create a submission link in Sharing. Contributors don’t need an account; what they send waits in Review.</p>
        <Field label="Prompt shown to contributors">
          <textarea className="input min-h-20" value={sub.prompt ?? ''} placeholder="What does home mean to you? Share a photo and tell us why." onChange={(e) => setSub({ prompt: e.target.value || undefined })} />
        </Field>
        <Field label="Consent text (contributors must agree before sending)">
          <textarea className="input min-h-20" value={sub.consent ?? ''} placeholder="I agree that my contribution may be published by…" onChange={(e) => setSub({ consent: e.target.value || undefined })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!sub.askName} onChange={(e) => setSub({ askName: e.target.checked || undefined })} />
            Ask for the contributor’s name
          </label>
          <Field label="Location of submissions">
            <select className="input" value={sub.locationPrecision ?? 'exact'} onChange={(e) => setSub({ locationPrecision: e.target.value as 'exact' })}>
              <option value="exact">Exact</option>
              <option value="approximate">Approximate (~1 km)</option>
              <option value="none">Don’t collect</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Sub-channels">
        {channel.children.length > 0 && (
          <ul className="space-y-1 text-sm">
            {channel.children.map((c) => (
              <li key={c.id}>
                <Link className="text-accent underline" href={`/edit/${c.id}`}>{c.title}</Link>
              </li>
            ))}
          </ul>
        )}
        <NewChannel parentId={channel.id} label="Add sub-channel" />
      </Section>

      {videoEnabled && <VideoRequest channelId={channel.id} signedIn={signedIn} />}

      {isOwner && (
        <Section title="Danger zone">
          <button
            className="btn-danger"
            onClick={async () => {
              if (prompt(`Type the channel title to delete it and everything in it:\n${channel.title}`) !== channel.title) return;
              await api(`/api/channels/${channel.id}`, { method: 'DELETE' });
              router.push('/');
            }}
          >
            Delete channel
          </button>
        </Section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 p-3">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          {saved && <span className="text-sm text-muted">Saved</span>}
          <button className="btn-primary px-6 py-2" onClick={save} disabled={busy}>Save settings</button>
        </div>
      </div>
    </div>
  );
}

/** Drop empty strings and empty objects so settings stay small. */
function clean(s: ChannelSettings): ChannelSettings {
  const out = JSON.parse(JSON.stringify(s, (_k, v) => (v === '' ? undefined : v)));
  if (out.submissions && !Object.keys(out.submissions).length) delete out.submissions;
  return out;
}

function TagManager({ editor, settings, set }: { editor: EditorApi; settings: ChannelSettings; set: (p: Partial<ChannelSettings>) => void }) {
  const { items } = editor.channel;
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((i) => i.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  // Renaming onto an existing tag merges them. Deleting is renaming to nothing.
  async function rename(from: string, to: string | null) {
    const patches = items
      .filter((i) => i.tags.includes(from))
      .map((i) => ({ id: i.id, tags: [...new Set(i.tags.flatMap((t) => (t === from ? (to ? [to] : []) : [t])))] }));
    await editor.patchItems(patches).catch(() => {});
    const colors = { ...settings.tagColors };
    if (to && colors[from] && !colors[to]) colors[to] = colors[from];
    delete colors[from];
    set({ tagColors: colors });
  }

  if (!tags.length) return <p className="text-sm text-muted">No tags yet. Add tags to items to color-code and filter them.</p>;
  return (
    <ul className="divide-y divide-line rounded border border-line">
      {tags.map(([tag, count]) => (
        <li key={tag} className="flex items-center gap-3 p-2 text-sm">
          <input
            type="color"
            aria-label={`Color for ${tag}`}
            value={settings.tagColors?.[tag] ?? '#999999'}
            onChange={(e) => set({ tagColors: { ...settings.tagColors, [tag]: e.target.value } })}
            className="h-7 w-10"
          />
          <span className="flex-1">
            {tag} <span className="text-muted">({count})</span>
          </span>
          <button className="underline" onClick={() => { const to = prompt(`Rename "${tag}" to (an existing tag merges):`, tag)?.trim(); if (to && to !== tag) rename(tag, to); }}>
            rename
          </button>
          <button className="text-red-700 underline" onClick={() => confirm(`Remove "${tag}" from ${count} items?`) && rename(tag, null)}>
            delete
          </button>
        </li>
      ))}
    </ul>
  );
}

function Overlays({ settings, set, center, upload }: { settings: ChannelSettings; set: (p: Partial<ChannelSettings>) => void; center: Basics; upload: (f: File) => Promise<string> }) {
  const overlays = settings.overlays ?? [];
  const update = (i: number, p: Partial<(typeof overlays)[number]>) => set({ overlays: overlays.map((o, j) => (j === i ? { ...o, ...p } : o)) });
  const names = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];
  return (
    <Field label="Image overlays (historic maps, plans, drawings)">
      {overlays.map((o, i) => (
        <div key={i} className="mb-2 space-y-2 rounded border border-line p-2 text-xs">
          <div className="flex items-center gap-2">
            <img src={o.url} alt="" className="h-10 w-10 object-cover" />
            <label className="flex flex-1 items-center gap-2">
              Opacity
              <input type="range" min={0} max={1} step={0.05} value={o.opacity} onChange={(e) => update(i, { opacity: Number(e.target.value) })} />
            </label>
            <button className="text-red-700 underline" onClick={() => set({ overlays: overlays.filter((_, j) => j !== i) })}>remove</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
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
                      onChange={(e) => {
                        const corners = o.corners.map((cc, kk) => (kk === k ? { ...cc, [axis]: Number(e.target.value) } : cc)) as typeof o.corners;
                        update(i, { corners });
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <label className="btn cursor-pointer">
        Add overlay image
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
            const d = 0.05;
            set({
              overlays: [
                ...overlays,
                { url, opacity: 0.8, corners: [{ lat: lat + d, lng: lng - d }, { lat: lat + d, lng: lng + d }, { lat: lat - d, lng: lng + d }, { lat: lat - d, lng: lng - d }] },
              ],
            });
          }}
        />
      </label>
    </Field>
  );
}

function VideoRequest({ channelId, signedIn }: { channelId: string; signedIn: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('');
  return (
    <Section title="Make a video">
      <p className="text-sm text-muted">Renders the published items as a video with transitions and narration. The result is emailed to you.</p>
      <div className="flex gap-2">
        {!signedIn && <input className="input" type="email" placeholder="Email for the result" value={email} onChange={(e) => setEmail(e.target.value)} />}
        <button
          className="btn"
          onClick={async () => {
            setState('Sending…');
            try {
              await api(`/api/channels/${channelId}/video`, { method: 'POST', body: email ? { email } : {} });
              setState('Requested — check your email in a few minutes.');
            } catch (e) {
              setState((e as Error).message);
            }
          }}
        >
          Generate video
        </button>
      </div>
      {state && <p className="text-sm">{state}</p>}
    </Section>
  );
}

function FilePick({ accept, url, audio, onPick, onClear }: { accept: string; url?: string; audio?: boolean; onPick: (f: File) => Promise<void>; onClear: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url && (audio ? <audio src={url} controls className="h-8" /> : <img src={url} alt="" className="h-14 rounded object-cover" />)}
      <label className="btn cursor-pointer">
        {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        <input
          type="file"
          accept={accept}
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              await onPick(f);
            } catch (err) {
              alert((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {url && <button className="text-xs underline" onClick={onClear}>remove</button>}
    </div>
  );
}
