'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronDown, Eye, Inbox, Image as ImageIcon, Loader2, MoreHorizontal, Palette, Share2, Users, AlertCircle } from 'lucide-react';
import { api, setShareKey } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { useToast } from '@/components/Toast';
import { VIEW_LABELS } from '@/components/viewMeta';
import type { Channel, Item, ItemInput } from '@/lib/types';
import ContentTab from '@/components/editor/ContentTab';
import InboxTab from '@/components/editor/InboxTab';
import CollectTab from '@/components/editor/CollectTab';
import DesignTab from '@/components/editor/DesignTab';
import MoreTab from '@/components/editor/MoreTab';
import ShareDialog from '@/components/editor/ShareDialog';
import ItemPanel from '@/components/editor/ItemPanel';

export type PlanInfo = { name: string; storage: number; used: number } | null;
export type ItemPatch = Partial<Omit<Item, 'id'>> & { id: string };
type ChannelPatch = Partial<Pick<Channel, 'title' | 'description' | 'visibility' | 'lat' | 'lng' | 'zoom' | 'settings'>>;

/** What every editor panel gets: the channel, and mutations that update the screen at once and save in the background. */
export type EditorApi = {
  channel: Channel;
  isOwner: boolean;
  appUrl: string;
  addItems: (inputs: ItemInput[]) => Promise<void>;
  updateItems: (patches: ItemPatch[], opts?: { now?: boolean }) => void;
  deleteItems: (ids: string[]) => Promise<void>;
  updateChannel: (patch: ChannelPatch) => void;
  updateSettings: (patch: Partial<Channel['settings']>) => void;
  openItem: (id: string) => void;
  goTo: (tab: Tab) => void;
};

export type Tab = 'content' | 'inbox' | 'collect' | 'design' | 'more';
type SaveState = 'saved' | 'saving' | 'error';

const byPosition = (a: Item, b: Item) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0);

export default function Editor({ initial, shareKey, isOwner, signedIn, appUrl, plan }: { initial: Channel; shareKey: string | null; isOwner: boolean; signedIn: boolean; appUrl: string; plan: PlanInfo }) {
  const toast = useToast();
  const [channel, setChannel] = useState(initial);
  const [tab, setTab] = useState<Tab>(initial.items.some((i) => i.status === 'pending') ? 'inbox' : 'content');
  const [openId, setOpenId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [save, setSave] = useState<SaveState>('saved');
  const inflight = useRef(0);
  const latest = useRef(channel);
  latest.current = channel;

  useEffect(() => setShareKey(shareKey), [shareKey]);

  // Every write goes through here so the header can say "Saving…" / "Saved".
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      inflight.current++;
      setSave('saving');
      try {
        const result = await fn();
        if (--inflight.current === 0) setSave('saved');
        return result;
      } catch (e) {
        inflight.current--;
        setSave('error');
        toast((e as Error).message, 'error');
        throw e;
      }
    },
    [toast],
  );

  // Channel fields: update now, save shortly after the last change.
  const flushChannel = useDebounced(() => {
    const c = latest.current;
    run(() =>
      api(`/api/channels/${c.id}`, {
        method: 'PATCH',
        body: { title: c.title, description: c.description, lat: c.lat, lng: c.lng, zoom: c.zoom, settings: c.settings, ...(isOwner && { visibility: c.visibility }) },
      }),
    ).catch(() => {});
  }, 700);

  // Item edits are merged per item and sent as one batch.
  const pending = useRef(new Map<string, ItemPatch>());
  const flushItems = useCallback(() => {
    const patches = [...pending.current.values()];
    pending.current.clear();
    if (patches.length) run(() => api('/api/items', { method: 'PATCH', body: { items: patches } })).catch(() => {});
  }, [run]);
  const flushItemsSoon = useDebounced(flushItems, 700);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (inflight.current || pending.current.size) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const editor: EditorApi = {
    channel,
    isOwner,
    appUrl,
    addItems: async (inputs) => {
      const added = await run(() => api<Item[]>(`/api/channels/${channel.id}/items`, { method: 'POST', body: { items: inputs } }));
      setChannel((c) => ({ ...c, items: [...c.items, ...added].sort(byPosition) }));
      toast(added.length === 1 ? 'Added' : `Added ${added.length} items`);
    },
    updateItems: (patches, { now = false } = {}) => {
      const byId = new Map(patches.map((p) => [p.id, p]));
      setChannel((c) => ({ ...c, items: c.items.map((i) => (byId.has(i.id) ? { ...i, ...byId.get(i.id) } : i)).sort(byPosition) }));
      for (const p of patches) pending.current.set(p.id, { ...pending.current.get(p.id), ...p });
      setSave('saving');
      if (now) flushItems();
      else flushItemsSoon();
    },
    deleteItems: async (ids) => {
      await run(() => api('/api/items', { method: 'DELETE', body: { ids } }));
      ids.forEach((id) => pending.current.delete(id));
      setChannel((c) => ({ ...c, items: c.items.filter((i) => !ids.includes(i.id)) }));
      if (openId && ids.includes(openId)) setOpenId(null);
      toast(ids.length === 1 ? 'Deleted' : `Deleted ${ids.length} items`);
    },
    updateChannel: (patch) => {
      setChannel((c) => ({ ...c, ...patch }));
      setSave('saving');
      flushChannel();
    },
    updateSettings: (patch) => {
      setChannel((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
      setSave('saving');
      flushChannel();
    },
    openItem: setOpenId,
    goTo: setTab,
  };

  const inbox = useMemo(() => channel.items.filter((i) => i.status === 'pending'), [channel.items]);
  const content = channel.items.length - inbox.length;
  const tabs: [Tab, string, React.ReactNode, number?][] = [
    ['content', 'Content', <ImageIcon key="i" size={16} />, content],
    ['inbox', 'Inbox', <Inbox key="i" size={16} />, inbox.length || undefined],
    ['collect', 'Collect', <Users key="i" size={16} />],
    ['design', 'Design', <Palette key="i" size={16} />],
    ['more', 'More', <MoreHorizontal key="i" size={16} />],
  ];
  const viewQuery = shareKey && channel.visibility === 'private' ? `?key=${encodeURIComponent(shareKey)}` : '';
  const openItem = channel.items.find((i) => i.id === openId);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-4">
          {signedIn && (
            <Link href={channel.parent ? `/edit/${channel.parent.slug}` : '/'} className="rounded p-1.5 text-muted hover:bg-card" title={channel.parent ? `Back to ${channel.parent.title}` : 'All projects'}>
              <ArrowLeft size={18} />
            </Link>
          )}
          <input
            value={channel.title}
            onChange={(e) => editor.updateChannel({ title: e.target.value })}
            onBlur={(e) => !e.target.value.trim() && editor.updateChannel({ title: 'Untitled project' })}
            className="min-w-0 flex-1 truncate rounded bg-transparent px-1.5 py-1 text-lg font-semibold outline-none hover:bg-card focus:bg-card"
            aria-label="Project title"
          />
          <SaveIndicator state={save} />
          <PreviewMenu slug={channel.slug} query={viewQuery} />
          <button className="btn-primary" onClick={() => setSharing(true)}>
            <Share2 size={16} /> <span className="hidden sm:inline">Share</span>
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 sm:px-4" role="tablist">
          {tabs.map(([t, label, icon, count]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg'}`}
            >
              {icon}
              {label}
              {count !== undefined && (
                <span className={`rounded-full px-1.5 text-xs ${t === 'inbox' ? 'bg-accent text-accent-fg' : 'bg-card text-muted'}`}>{count}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        {plan && plan.storage !== Infinity && <UsageBar used={plan.used} limit={plan.storage} name={plan.name} />}
        {tab === 'content' && <ContentTab editor={editor} />}
        {tab === 'inbox' && <InboxTab editor={editor} />}
        {tab === 'collect' && <CollectTab editor={editor} />}
        {tab === 'design' && <DesignTab editor={editor} />}
        {tab === 'more' && <MoreTab editor={editor} />}
      </main>

      {openItem && <ItemPanel key={openItem.id} item={openItem} editor={editor} onClose={() => setOpenId(null)} />}
      {sharing && <ShareDialog editor={editor} onClose={() => setSharing(false)} />}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span className="hidden items-center gap-1 text-xs text-muted sm:flex" aria-live="polite">
      {state === 'saving' && (
        <>
          <Loader2 size={14} className="animate-spin" /> Saving…
        </>
      )}
      {state === 'saved' && (
        <>
          <Check size={14} /> Saved
        </>
      )}
      {state === 'error' && (
        <span className="flex items-center gap-1 text-red-700">
          <AlertCircle size={14} /> Not saved
        </span>
      )}
    </span>
  );
}

function PreviewMenu({ slug, query }: { slug: string; query: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Eye size={16} /> <span className="hidden sm:inline">Preview</span> <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-bg shadow-lg">
            {VIEW_LABELS.map(({ view, label, Icon }) => (
              <a key={view} href={`/c/${slug}/${view}${query}`} target="_blank" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-card" onClick={() => setOpen(false)}>
                <Icon size={16} /> {label}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UsageBar({ used, limit, name }: { used: number; limit: number; name: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const mb = (b: number) => `${Math.round(b / 1024 / 1024)} MB`;
  return (
    <div className="mb-4 text-xs text-muted">
      <div className="mb-1">
        {mb(used)} of {mb(limit)} used · {name} plan
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-card">
        <div className={`h-full ${pct >= 80 ? 'bg-red-600' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
