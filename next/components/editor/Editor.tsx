'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, setShareKey } from '@/lib/api';
import type { Channel, Item, ItemInput } from '@/lib/types';
import type { Feature } from '@/lib/plans';
import ItemList from '@/components/editor/ItemList';
import SettingsForm from '@/components/editor/SettingsForm';
import Sharing from '@/components/editor/Sharing';
import ExportPanel from '@/components/editor/ExportPanel';
import Uploader from '@/components/Uploader';

export type PlanInfo = { name: string; storage: number; used: number; features: Feature[] } | null;
export type ItemPatch = Partial<Omit<Item, 'id' | 'takenAt'>> & { id: string; takenAt?: string | null };

/** Everything the editor panels need: state plus the four mutations. */
export type EditorApi = {
  channel: Channel;
  addItems: (inputs: ItemInput[]) => Promise<void>;
  patchItems: (patches: ItemPatch[]) => Promise<void>;
  deleteItems: (ids: string[]) => Promise<void>;
  saveChannel: (patch: Partial<Pick<Channel, 'title' | 'description' | 'visibility' | 'lat' | 'lng' | 'zoom' | 'settings'>>) => Promise<void>;
};

type Tab = 'items' | 'review' | 'settings' | 'sharing' | 'export';

type Props = {
  initial: Channel;
  shareKey: string | null;
  isOwner: boolean;
  signedIn: boolean;
  appUrl: string;
  videoEnabled: boolean;
  plan: PlanInfo;
};

export default function Editor({ initial, shareKey, isOwner, signedIn, appUrl, videoEnabled, plan }: Props) {
  const [channel, setChannel] = useState(initial);
  const [tab, setTab] = useState<Tab>('items');
  const [error, setError] = useState('');

  useEffect(() => setShareKey(shareKey), [shareKey]);

  // Every mutation goes through here: call the API, merge the result, surface errors.
  async function run(fn: () => Promise<void>) {
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }

  const editor: EditorApi = {
    channel,
    addItems: (inputs) =>
      run(async () => {
        const added = await api<Item[]>(`/api/channels/${channel.id}/items`, { method: 'POST', body: { items: inputs } });
        setChannel((c) => ({ ...c, items: [...c.items, ...added] }));
      }),
    patchItems: (patches) =>
      run(async () => {
        if (!patches.length) return;
        const updated = await api<Item[]>('/api/items', { method: 'PATCH', body: { items: patches } });
        const byId = new Map(updated.map((i) => [i.id, i]));
        setChannel((c) => ({
          ...c,
          items: c.items.map((i) => byId.get(i.id) ?? i).sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0)),
        }));
      }),
    deleteItems: (ids) =>
      run(async () => {
        await api('/api/items', { method: 'DELETE', body: { ids } });
        setChannel((c) => ({ ...c, items: c.items.filter((i) => !ids.includes(i.id)) }));
      }),
    saveChannel: (patch) =>
      run(async () => {
        await api(`/api/channels/${channel.id}`, { method: 'PATCH', body: patch });
        setChannel((c) => ({ ...c, ...patch }));
      }),
  };

  const pending = useMemo(() => channel.items.filter((i) => i.status === 'pending'), [channel.items]);
  const q = shareKey && channel.visibility === 'private' ? `?key=${encodeURIComponent(shareKey)}` : '';
  const tabs: [Tab, string][] = [
    ['items', `Items (${channel.items.length - pending.length})`],
    ['review', `Review${pending.length ? ` (${pending.length})` : ''}`],
    ['settings', 'Settings'],
    ...(isOwner ? ([['sharing', 'Sharing']] as [Tab, string][]) : []),
    ['export', 'Export'],
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          {signedIn && (
            <Link href={channel.parent ? `/edit/${channel.parent.slug}` : '/'} className="text-sm text-muted hover:underline">
              ← {channel.parent?.title ?? 'Channels'}
            </Link>
          )}
          <h1 className="min-w-0 flex-1 truncate font-semibold">{channel.title}</h1>
          <span className="chip hidden sm:inline-flex">{channel.visibility}</span>
          {(['map', 'reel', 'grid', 'story'] as const).map((v) => (
            <a key={v} href={`/c/${channel.slug}/${v}${q}`} target="_blank" className="hidden text-sm text-accent hover:underline sm:inline">
              {v}
            </a>
          ))}
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
          {tabs.map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-accent font-medium' : 'border-transparent text-muted'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {error && (
          <div className="flex items-start justify-between rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
            <button onClick={() => setError('')} aria-label="Dismiss">✕</button>
          </div>
        )}
        {plan && plan.storage !== Infinity && (
          <UsageBar used={plan.used} limit={plan.storage} name={plan.name} />
        )}
        {tab === 'items' && (
          <>
            <Uploader channelId={channel.id} onAdd={editor.addItems} compact={channel.items.length > 0} />
            <ItemList editor={editor} filter="curated" />
          </>
        )}
        {tab === 'review' && <ItemList editor={editor} filter="pending" />}
        {tab === 'settings' && <SettingsForm editor={editor} isOwner={isOwner} videoEnabled={videoEnabled} signedIn={signedIn} />}
        {tab === 'sharing' && isOwner && <Sharing channel={channel} appUrl={appUrl} />}
        {tab === 'export' && <ExportPanel channel={channel} />}
      </main>
    </div>
  );
}

function UsageBar({ used, limit, name }: { used: number; limit: number; name: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const mb = (b: number) => `${Math.round(b / 1024 / 1024)} MB`;
  return (
    <div className="text-xs text-muted">
      <div className="mb-1">
        {mb(used)} of {mb(limit)} used ({name} plan)
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-card">
        <div className={`h-full ${pct >= 80 ? 'bg-red-600' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
