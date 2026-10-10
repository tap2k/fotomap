'use client';

import { useRef, useState } from 'react';
import { prepareFile, uploadPrepared, uploadBlobs } from '@/lib/upload';
import type { ItemInput } from '@/lib/types';

type Job = { id: number; name: string; progress: number; error?: string };

/**
 * Every way to add something: files (drag & drop), camera, audio recording, a link, a text card.
 * Uploads go straight to storage; the parent decides what to do with the resulting item inputs.
 */
export default function Uploader({
  channelId,
  onAdd,
  compact = false,
}: {
  channelId: string;
  onAdd: (inputs: ItemInput[]) => Promise<void> | void;
  compact?: boolean;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);
  const [mode, setMode] = useState<null | 'link' | 'text'>(null);
  const files = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const update = (id: number, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  async function addFiles(list: FileList | File[]) {
    const queue = [...list].map((file) => ({ file, id: nextId.current++ }));
    setJobs((js) => [...js, ...queue.map(({ file, id }) => ({ id, name: file.name, progress: 0 }))]);
    // A few at a time keeps phones responsive.
    const results: ItemInput[] = [];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const prepared = await prepareFile(job.file);
          const id = job.id;
          results.push(await uploadPrepared(channelId, prepared, (p) => update(id, { progress: p })));
          setJobs((js) => js.filter((j) => j.id !== id));
        } catch (e) {
          update(job.id, { error: (e as Error).message });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (results.length) await onAdd(results);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-4 text-center transition ${drag ? 'border-accent bg-card' : 'border-line'} ${compact ? 'py-3' : 'py-8'}`}
      >
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={() => files.current?.click()}>
            Add photos, video or audio
          </button>
          <button type="button" className="btn sm:hidden" onClick={() => camera.current?.click()}>
            Camera
          </button>
          <AudioRecorder
            onRecorded={async (blob) => {
              const id = nextId.current++;
              setJobs((js) => [...js, { id, name: 'Recording', progress: 0 }]);
              try {
                const [f] = await uploadBlobs(channelId, [{ blob, name: `recording.${blob.type.includes('mp4') ? 'm4a' : 'webm'}` }], (p) =>
                  update(id, { progress: p }),
                );
                setJobs((js) => js.filter((j) => j.id !== id));
                await onAdd([{ kind: 'audio', url: f.url, title: 'Recording', takenAt: new Date() }]);
              } catch (e) {
                update(id, { error: (e as Error).message });
              }
            }}
          />
          <button type="button" className="btn" onClick={() => setMode(mode === 'link' ? null : 'link')}>
            Link
          </button>
          <button type="button" className="btn" onClick={() => setMode(mode === 'text' ? null : 'text')}>
            Text
          </button>
        </div>
        {!compact && <p className="mt-2 text-xs text-muted">or drop files here · location is read from photos automatically</p>}
        <input ref={files} type="file" multiple accept="image/*,video/*,audio/*" hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <input ref={camera} type="file" accept="image/*,video/*" capture="environment" hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>

      {mode && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get('value') ?? '').trim();
            if (!value) return;
            await onAdd([mode === 'link' ? { kind: 'embed', url: value } : { kind: 'text', caption: value }]);
            setMode(null);
          }}
        >
          {mode === 'link' ? (
            <input name="value" type="url" required placeholder="https://youtube.com/watch?v=…" className="input" autoFocus />
          ) : (
            <textarea name="value" required placeholder="Write something…" className="input min-h-20" autoFocus />
          )}
          <button className="btn-primary">Add</button>
        </form>
      )}

      {jobs.map((j) => (
        <div key={j.id} className="flex items-center gap-2 text-sm">
          <span className="w-40 truncate">{j.name}</span>
          {j.error ? (
            <>
              <span className="flex-1 text-red-600">{j.error}</span>
              <button className="text-xs underline" onClick={() => setJobs((js) => js.filter((x) => x.id !== j.id))}>
                dismiss
              </button>
            </>
          ) : (
            <div className="h-2 flex-1 overflow-hidden rounded bg-card">
              <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(j.progress * 100)}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Microphone recording with MediaRecorder. */
export function AudioRecorder({ onRecorded, label = 'Record audio' }: { onRecorded: (blob: Blob) => void; label?: string }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<{ recorder: MediaRecorder; timer: ReturnType<typeof setInterval> } | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        onRecorded(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.start();
      setSeconds(0);
      rec.current = { recorder, timer: setInterval(() => setSeconds((s) => s + 1), 1000) };
      setRecording(true);
    } catch {
      alert('Microphone access is needed to record.');
    }
  }

  function stop() {
    if (!rec.current) return;
    clearInterval(rec.current.timer);
    rec.current.recorder.stop();
    rec.current = null;
    setRecording(false);
  }

  return recording ? (
    <button type="button" className="btn-danger" onClick={stop}>
      ■ Stop {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </button>
  ) : (
    <button type="button" className="btn" onClick={start}>
      ● {label}
    </button>
  );
}
