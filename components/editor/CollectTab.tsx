'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink, MapPin, MapPinned, MapPinOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Field, Section } from '@/components/ui';
import type { EditorApi } from '@/components/editor/Editor';
import type { ChannelSettings } from '@/lib/types';

export type Grant = { id: string; role: string; label: string; email: string | null; isLink: boolean; url: string | null };

/** Load this project's grants (owners only). Shared by Collect and Share. */
export function useGrants(channelId: string, enabled: boolean) {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const reload = useCallback(async () => {
    if (enabled) setGrants(await api<Grant[]>(`/api/channels/${channelId}/grants`).catch(() => []));
  }, [channelId, enabled]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { grants, reload };
}

const PRIVACY: { value: NonNullable<NonNullable<ChannelSettings['submissions']>['locationPrecision']>; label: string; text: string; Icon: typeof MapPin }[] = [
  { value: 'exact', label: 'Exact', text: 'Use the location from the photo or phone as is.', Icon: MapPin },
  { value: 'approximate', label: 'Approximate', text: 'Round to about 1 km to protect people’s homes.', Icon: MapPinned },
  { value: 'none', label: 'Don’t collect', text: 'Ignore location completely.', Icon: MapPinOff },
];

export default function CollectTab({ editor }: { editor: EditorApi }) {
  const { channel, isOwner } = editor;
  const toast = useToast();
  const { grants, reload } = useGrants(channel.id, isOwner);
  const link = grants?.find((g) => g.isLink && g.role === 'submitter');
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const s = channel.settings.submissions ?? {};
  const setSub = (p: Partial<typeof s>) => editor.updateSettings({ submissions: { ...s, ...p } });

  useEffect(() => {
    if (link?.url) QRCode.toDataURL(link.url, { margin: 1, width: 480 }).then(setQr);
  }, [link?.url]);

  async function setOpen(open: boolean) {
    setBusy(true);
    try {
      if (open) await api(`/api/channels/${channel.id}/grants`, { method: 'POST', body: { type: 'link', role: 'submitter', label: 'Contribution link' } });
      else {
        if (!confirm('Turn off contributions? The current link and QR code will stop working.')) return;
        for (const g of grants!.filter((g) => g.isLink && g.role === 'submitter')) await api(`/api/channels/${channel.id}/grants`, { method: 'DELETE', body: { grantId: g.id } });
      }
      await reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Section title="Contributions">
        {!isOwner ? (
          <p className="text-sm text-muted">Only project owners can turn contributions on or off. You can still edit the prompt below.</p>
        ) : grants === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <>
            <label className="card flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Accept contributions</span>
                <span className="text-sm text-muted">Anyone with the link can send photos, video, voice notes and text — no account needed. You approve everything in the Inbox first.</span>
              </span>
              <input type="checkbox" role="switch" className="switch" checked={busy ? !link : !!link} disabled={busy} onChange={(e) => setOpen(e.target.checked)} />
            </label>
            {link?.url && (
              <div className="card flex flex-col gap-4 sm:flex-row">
                {qr && <img src={qr} alt="QR code for the contribution link" className="h-44 w-44 self-center rounded bg-white p-1" />}
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-sm text-muted">Share this link, or print the QR code for workshops, posters and flyers.</p>
                  <input readOnly value={link.url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="Contribution link" />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={() => navigator.clipboard.writeText(link.url!).then(() => toast('Link copied'))}>
                      <Copy size={16} /> Copy link
                    </button>
                    {qr && (
                      <a className="btn" href={qr} download={`${channel.slug}-qr.png`}>
                        <Download size={16} /> QR code
                      </a>
                    )}
                    <a className="btn" href={link.url} target="_blank">
                      <ExternalLink size={16} /> Open
                    </a>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="What contributors see">
        <Field label="Invitation">
          <textarea className="input min-h-24" value={s.prompt ?? ''} placeholder="What would you like people to share? e.g. “Take a photo of a place that matters to you and tell us why.”" onChange={(e) => setSub({ prompt: e.target.value || undefined })} />
        </Field>
        <Field label="Consent statement">
          <textarea className="input min-h-20" value={s.consent ?? ''} placeholder="Optional. If set, contributors must tick this before sending. e.g. “I agree that my contribution may be published.”" onChange={(e) => setSub({ consent: e.target.value || undefined })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!s.askName} onChange={(e) => setSub({ askName: e.target.checked || undefined })} />
          Ask for their name (optional for them)
        </label>
      </Section>

      <Section title="Location privacy">
        <div className="grid gap-2 sm:grid-cols-3">
          {PRIVACY.map(({ value, label, text, Icon }) => {
            const active = (s.locationPrecision ?? 'exact') === value;
            return (
              <button key={value} onClick={() => setSub({ locationPrecision: value })} className={`card text-left ${active ? 'border-accent ring-2 ring-accent' : 'hover:bg-card'}`}>
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon size={16} /> {label}
                </span>
                <span className="text-sm text-muted">{text}</span>
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
