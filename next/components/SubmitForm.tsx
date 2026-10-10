'use client';

import { useEffect, useState } from 'react';
import Uploader from '@/components/Uploader';
import Text from '@/components/Text';
import { api, setShareKey } from '@/lib/api';
import type { ItemInput } from '@/lib/types';

type Props = { channelId: string; token: string; consent: string; askName: boolean; locationPrecision: 'exact' | 'approximate' | 'none' };

export default function SubmitForm({ channelId, token, consent, askName, locationPrecision }: Props) {
  const [drafts, setDrafts] = useState<ItemInput[]>([]);
  const [agreed, setAgreed] = useState(!consent);
  const [name, setName] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'done'>('editing');
  const [error, setError] = useState('');

  useEffect(() => setShareKey(token), [token]);

  const patch = (i: number, p: Partial<ItemInput>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));

  function locate(i: number) {
    navigator.geolocation.getCurrentPosition(
      (pos) => patch(i, { lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => alert('Could not get your location.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit() {
    setState('sending');
    setError('');
    try {
      const contributor = { name: name.trim() || undefined, consent: consent ? agreed : undefined };
      await api(`/api/channels/${channelId}/items`, {
        method: 'POST',
        body: { items: drafts.map((d) => ({ ...d, meta: { ...d.meta, contributor } })) },
      });
      setDrafts([]);
      setState('done');
    } catch (e) {
      setError((e as Error).message);
      setState('editing');
    }
  }

  if (state === 'done')
    return (
      <div className="space-y-3 rounded-lg bg-card p-6 text-center">
        <p className="text-lg font-medium">Thank you! Your contribution was received.</p>
        <p className="text-sm text-muted">The organisers will review it before it appears.</p>
        <button className="btn" onClick={() => setState('editing')}>Add more</button>
      </div>
    );

  return (
    <div className="space-y-5">
      <Uploader channelId={channelId} onAdd={(inputs) => setDrafts((d) => [...d, ...inputs])} />

      {drafts.map((d, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-line p-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-card text-center text-xs leading-[5rem] text-muted">
            {d.thumbUrl || d.kind === 'image' ? <img src={(d.thumbUrl ?? d.url)!} alt="" className="h-full w-full object-cover" /> : d.kind}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input className="input" placeholder="Title (optional)" value={d.title ?? ''} onChange={(e) => patch(i, { title: e.target.value })} />
            <textarea className="input min-h-16" placeholder="Tell us about this…" value={d.caption ?? ''} onChange={(e) => patch(i, { caption: e.target.value })} />
            <div className="flex items-center justify-between text-xs text-muted">
              {locationPrecision === 'none' ? (
                <span>Location is not collected</span>
              ) : d.lat != null ? (
                <span>📍 Location attached{locationPrecision === 'approximate' ? ' (rounded to ~1 km)' : ''}</span>
              ) : (
                <button type="button" className="underline" onClick={() => locate(i)}>Add my current location</button>
              )}
              <button type="button" className="underline" onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </div>
        </div>
      ))}

      {drafts.length > 0 && (
        <div className="space-y-3 rounded-lg bg-card p-4">
          {askName && (
            <div>
              <label className="label" htmlFor="name">Your name (optional)</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </div>
          )}
          {consent && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <Text text={consent} />
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full py-2.5" disabled={!agreed || state === 'sending'} onClick={submit}>
            {state === 'sending' ? 'Sending…' : `Send ${drafts.length} item${drafts.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  );
}
