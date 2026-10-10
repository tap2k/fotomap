'use client';

import { useState } from 'react';
import { zip } from 'fflate';
import type { Channel } from '@/lib/types';

/** Data handover: structured files from the server, media ZIP assembled in the browser. */
export default function ExportPanel({ channel }: { channel: Channel }) {
  const [status, setStatus] = useState('');
  const base = `/api/channels/${channel.id}/export?format=`;

  async function downloadZip() {
    const files: Record<string, Uint8Array> = {};
    const media = channel.items.flatMap((item, n) =>
      [item.url, item.audioUrl].filter((u): u is string => !!u && item.kind !== 'embed').map((u, k) => ({ u, name: `${String(n + 1).padStart(3, '0')}-${item.id}${k ? '-audio' : ''}${ext(u)}` })),
    );
    let done = 0;
    for (const { u, name } of media) {
      setStatus(`Downloading ${++done} of ${media.length}…`);
      try {
        files[`media/${name}`] = new Uint8Array(await (await fetch(u)).arrayBuffer());
      } catch {
        /* skip files the browser can't fetch (e.g. missing CORS) */
      }
    }
    const csv = await (await fetch(base + 'csv')).text();
    files['items.csv'] = new TextEncoder().encode(csv);
    files['channel.json'] = new TextEncoder().encode(JSON.stringify(channel, null, 2));
    setStatus('Compressing…');
    zip(files, { level: 0 }, (err, data) => {
      if (err) return setStatus(err.message);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/zip' }));
      a.download = `${channel.slug}.zip`;
      a.click();
      setStatus('');
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Your data is yours. Exports include drafts, pending submissions and private notes.</p>
      <div className="flex flex-wrap gap-2">
        <a className="btn" href={base + 'csv'}>Spreadsheet (CSV)</a>
        <a className="btn" href={base + 'geojson'}>Map data (GeoJSON)</a>
        <a className="btn" href={base + 'json'}>Everything (JSON)</a>
        <button className="btn-primary" onClick={downloadZip} disabled={!!status}>Media + data (ZIP)</button>
      </div>
      {status && <p className="text-sm">{status}</p>}
      <p className="text-xs text-muted">CSV opens in Excel, NVivo, Atlas.ti and R. GeoJSON opens in QGIS and ArcGIS.</p>
    </div>
  );
}

const ext = (u: string) => u.split(/[?#]/)[0].match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '';
