'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import type { Channel } from '@/lib/types';

type Grant = { id: string; role: string; label: string; email: string | null; isLink: boolean };

const LINK_HELP: Record<string, string> = {
  submitter: 'Contributors can send photos, video, audio and notes. Nothing appears until you approve it.',
  viewer: 'Anyone with the link can view, even when the channel is private.',
  editor: 'Anyone with the link can edit — like a shared password. Prefer inviting people by email.',
};

export default function Sharing({ channel, appUrl }: { channel: Channel; appUrl: string }) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [created, setCreated] = useState<{ url: string; qr: string; role: string } | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api<Grant[]>(`/api/channels/${channel.id}/grants`).then(setGrants, (e) => setError(e.message)), [channel.id]);
  useEffect(() => {
    load();
  }, [load]);

  async function call(body: object, method = 'POST') {
    setError('');
    try {
      const res = await api<{ url?: string }>(`/api/channels/${channel.id}/grants`, { method, body });
      if (res.url) setCreated({ url: res.url, qr: await QRCode.toDataURL(res.url, { margin: 1, width: 240 }), role: (body as { role: string }).role });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const people = grants.filter((g) => !g.isLink);
  const links = grants.filter((g) => g.isLink);
  const embed = `<iframe src="${appUrl}/embed/${channel.slug}/${channel.settings.defaultView ?? 'map'}" width="100%" height="560" style="border:0" allowfullscreen></iframe>`;

  return (
    <div className="space-y-8">
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">People</h2>
        <ul className="divide-y divide-line rounded border border-line text-sm">
          {people.map((g) => (
            <li key={g.id} className="flex items-center gap-2 p-2">
              <span className="flex-1">{g.email ?? 'Unknown'}</span>
              <span className="chip">{g.role}</span>
              <button className="text-red-700 underline" onClick={() => call({ grantId: g.id }, 'DELETE')}>remove</button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            call({ type: 'invite', email: f.get('email'), role: f.get('role') });
            e.currentTarget.reset();
          }}
        >
          <input name="email" type="email" required placeholder="name@example.org" className="input min-w-0 flex-1" />
          <select name="role" className="input w-auto">
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="owner">Owner</option>
          </select>
          <button className="btn-primary">Invite</button>
        </form>
        {channel.parent && <p className="text-xs text-muted">People with access to “{channel.parent.title}” also have access here.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Links</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => call({ type: 'link', role: 'submitter', label: 'Submission link' })}>New submission link</button>
          <button className="btn" onClick={() => call({ type: 'link', role: 'viewer', label: 'View link' })}>New view link</button>
          <button className="btn" onClick={() => call({ type: 'link', role: 'editor', label: 'Edit link' })}>New edit link</button>
        </div>
        {created && (
          <div className="flex flex-col gap-3 rounded-lg bg-card p-4 sm:flex-row">
            <img src={created.qr} alt="QR code for the link" className="h-40 w-40 self-center bg-white p-1" />
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <p className="font-medium">Copy this link now — it won’t be shown again.</p>
              <p className="text-muted">{LINK_HELP[created.role]}</p>
              <input readOnly value={created.url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
              <div className="flex gap-2">
                <button className="btn" onClick={() => navigator.clipboard.writeText(created.url)}>Copy</button>
                <a className="btn" href={created.qr} download="fotomap-qr.png">Download QR</a>
              </div>
            </div>
          </div>
        )}
        {links.length > 0 && (
          <ul className="divide-y divide-line rounded border border-line text-sm">
            {links.map((g) => (
              <li key={g.id} className="flex items-center gap-2 p-2">
                <span className="flex-1">{g.label || 'Link'}</span>
                <span className="chip">{g.role}</span>
                <button className="text-red-700 underline" onClick={() => call({ grantId: g.id }, 'DELETE')}>revoke</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Embed</h2>
        <p className="text-sm text-muted">
          Paste into a website. Change <code>/map</code> to <code>/reel</code>, <code>/grid</code> or <code>/story</code>.
          {channel.visibility === 'private' && ' The channel is private: embeds only work after you make it unlisted or public.'}
        </p>
        <textarea readOnly value={embed} className="input min-h-20 font-mono text-xs" onFocus={(e) => e.target.select()} />
      </section>
    </div>
  );
}
