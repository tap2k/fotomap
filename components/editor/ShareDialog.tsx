'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Globe, Link2, Lock, Trash2, UserPlus } from 'lucide-react';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useGrants } from '@/components/editor/CollectTab';
import type { EditorApi } from '@/components/editor/Editor';
import type { Channel } from '@/lib/types';

const VISIBILITY: { value: Channel['visibility']; label: string; text: string; Icon: typeof Lock }[] = [
  { value: 'private', label: 'Private', text: 'Only people you invite', Icon: Lock },
  { value: 'unlisted', label: 'Anyone with the link', text: 'Not listed anywhere', Icon: Link2 },
  { value: 'public', label: 'Public', text: 'Also listed on the Fotomap home page', Icon: Globe },
];

/** One place for "who can see this" and "how do I send it to people". */
export default function ShareDialog({ editor, onClose }: { editor: EditorApi; onClose: () => void }) {
  const { channel, isOwner, appUrl } = editor;
  const toast = useToast();
  const { grants, reload } = useGrants(channel.id, isOwner);
  const viewLink = grants?.find((g) => g.isLink && g.role === 'viewer');
  const editLinks = grants?.filter((g) => g.isLink && g.role === 'editor') ?? [];
  const people = grants?.filter((g) => !g.isLink) ?? [];
  const isPrivate = channel.visibility === 'private';
  const url = isPrivate ? (viewLink?.url ?? null) : `${appUrl}/c/${channel.slug}`;
  const [qr, setQr] = useState('');
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 400 }).then(setQr);
    else setQr('');
  }, [url]);

  async function call(body: object, method = 'POST', done?: string) {
    try {
      await api(`/api/channels/${channel.id}/grants`, { method, body });
      await reload();
      if (done) toast(done);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  const copy = (text: string, what = 'Link copied') => navigator.clipboard.writeText(text).then(() => toast(what));
  const embed = `<iframe src="${appUrl}/embed/${channel.slug}/${channel.settings.defaultView ?? 'map'}" width="100%" height="560" style="border:0" allowfullscreen></iframe>`;

  return (
    <Modal title={`Share “${channel.title}”`} onClose={onClose} wide>
      <div className="space-y-6">
        {isOwner && (
          <div className="grid gap-2 sm:grid-cols-3">
            {VISIBILITY.map(({ value, label, text, Icon }) => {
              const active = channel.visibility === value;
              return (
                <button key={value} onClick={() => editor.updateChannel({ visibility: value })} className={`card p-3 text-left ${active ? 'border-accent ring-2 ring-accent' : 'hover:bg-card'}`} aria-pressed={active}>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon size={16} /> {label}
                  </span>
                  <span className="text-xs text-muted">{text}</span>
                </button>
              );
            })}
          </div>
        )}

        <section className="space-y-2">
          <h3 className="font-medium">Link to view</h3>
          {url ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              {qr && <img src={qr} alt="QR code" className="h-28 w-28 self-center rounded bg-white p-1" />}
              <div className="min-w-0 flex-1 space-y-2">
                <input readOnly value={url} className="input font-mono text-xs" onFocus={(e) => e.target.select()} aria-label="View link" />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={() => copy(url)}>
                    <Copy size={16} /> Copy link
                  </button>
                  {qr && (
                    <a className="btn" href={qr} download={`${channel.slug}-qr.png`}>
                      <Download size={16} /> QR code
                    </a>
                  )}
                  {isPrivate && viewLink && (
                    <button className="btn text-red-700" onClick={() => call({ grantId: viewLink.id }, 'DELETE', 'Link turned off')}>
                      Turn off link
                    </button>
                  )}
                </div>
                {isPrivate && <p className="text-xs text-muted">This secret link lets anyone who has it view the private project.</p>}
              </div>
            </div>
          ) : isOwner ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">The project is private. Invite people below, or</span>
              <button className="btn" onClick={() => call({ type: 'link', role: 'viewer', label: 'View link' })}>
                create a secret view link
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">This project is private.</p>
          )}
        </section>

        <section className="space-y-2">
          <button className="text-sm font-medium underline" onClick={() => setShowEmbed((s) => !s)}>
            {showEmbed ? 'Hide' : 'Embed on a website'}
          </button>
          {showEmbed && (
            <>
              {isPrivate && <p className="text-xs text-muted">Embeds only work when the project isn’t private.</p>}
              <textarea readOnly value={embed} className="input min-h-20 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <button className="btn" onClick={() => copy(embed, 'Embed code copied')}>
                <Copy size={16} /> Copy embed code
              </button>
              <p className="text-xs text-muted">
                Change <code>/map</code> to <code>/reel</code>, <code>/grid</code> or <code>/story</code> for another view.
              </p>
            </>
          )}
        </section>

        {isOwner && (
          <section className="space-y-2">
            <h3 className="font-medium">People with access</h3>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                call({ type: 'invite', email: f.get('email'), role: f.get('role') }, 'POST', 'Invitation sent');
                e.currentTarget.reset();
              }}
            >
              <input name="email" type="email" required placeholder="Email address" className="input min-w-0 flex-1" aria-label="Email to invite" />
              <select name="role" className="input w-auto" aria-label="Role">
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
                <option value="owner">Owner</option>
              </select>
              <button className="btn-primary">
                <UserPlus size={16} /> Invite
              </button>
            </form>
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">
              {people.map((g) => (
                <li key={g.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{g.email}</span>
                  <span className="text-muted">{g.role === 'owner' ? 'Owner' : g.role === 'editor' ? 'Can edit' : 'Can view'}</span>
                  <button className="rounded p-1 text-muted hover:bg-card hover:text-red-700" onClick={() => call({ grantId: g.id }, 'DELETE')} aria-label={`Remove ${g.email}`}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            {channel.parent && <p className="text-xs text-muted">People with access to “{channel.parent.title}” can also access this sub-project.</p>}

            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Edit links (advanced)</summary>
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted">Anyone with an edit link can change this project without signing in — treat it like a password. Inviting people by email is safer.</p>
                {editLinks.map((g) => (
                  <div key={g.id} className="flex gap-2">
                    <input readOnly value={g.url ?? ''} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
                    <button className="btn" onClick={() => copy(g.url!)} aria-label="Copy edit link">
                      <Copy size={14} />
                    </button>
                    <button className="btn text-red-700" onClick={() => call({ grantId: g.id }, 'DELETE', 'Link turned off')} aria-label="Turn off edit link">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button className="btn" onClick={() => call({ type: 'link', role: 'editor', label: 'Edit link' })}>
                  Create edit link
                </button>
              </div>
            </details>
          </section>
        )}
      </div>
    </Modal>
  );
}
