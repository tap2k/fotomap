'use client';

import exifr from 'exifr';
import { api } from '@/lib/api';
import type { ItemInput, Kind } from '@/lib/types';

type Blob2 = { blob: Blob; name: string };
export type Prepared = {
  main: Blob2;
  thumb?: Blob2;
  input: Omit<ItemInput, 'url' | 'thumbUrl'>;
};

const FULL = 2048;
const FULL_360 = 8192;
const THUMB = 480;

const baseName = (name: string) => name.replace(/\.[^.]+$/, '');
const is360Name = (name: string) => /_(360|180)(\.|$)/i.test(name);

function kindOf(file: File): Kind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}

async function resize(source: CanvasImageSource & { width: number; height: number }, max: number, quality = 0.85): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/webp', quality),
  );
}

/** A frame ~1s in, as the video's poster/thumbnail. */
function videoFrame(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (b: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(b);
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    video.onloadeddata = () => (video.currentTime = Math.min(1, (video.duration || 2) / 2));
    video.onseeked = () =>
      resize(Object.assign(video, { width: video.videoWidth, height: video.videoHeight }), THUMB, 0.75).then(done, () => done(null));
    video.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
  });
}

/**
 * Everything heavy happens in the browser: read EXIF (location, date, 360), downscale
 * images to web sizes, grab a video thumbnail. The server only stores the results.
 */
export async function prepareFile(file: File): Promise<Prepared> {
  const kind = kindOf(file);
  if (!kind) throw new Error(`${file.name}: unsupported file type`);
  const input: Prepared['input'] = { kind, title: '', meta: {} };
  const name = baseName(file.name);

  if (kind === 'image') {
    const exif = await exifr.parse(file, { gps: true, xmp: true, tiff: true, exif: true }).catch(() => null);
    if (exif?.latitude != null && exif?.longitude != null) {
      input.lat = exif.latitude;
      input.lng = exif.longitude;
    }
    const taken = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (taken instanceof Date && !isNaN(+taken)) input.takenAt = taken;
    const is360 = is360Name(file.name) || exif?.ProjectionType === 'equirectangular';
    if (is360) input.meta = { is360: true };
    if (file.type === 'image/gif') return { main: { blob: file, name: file.name }, input };
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      return {
        main: { blob: await resize(bitmap, is360 ? FULL_360 : FULL), name: `${name}.webp` },
        thumb: { blob: await resize(bitmap, THUMB, 0.75), name: `${name}-thumb.webp` },
        input,
      };
    } finally {
      bitmap.close();
    }
  }

  if (is360Name(file.name)) input.meta = { is360: true };
  const frame = kind === 'video' ? await videoFrame(file) : null;
  return { main: { blob: file, name: file.name }, thumb: frame ? { blob: frame, name: `${name}-thumb.webp` } : undefined, input };
}

function put(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.send(blob);
  });
}

type Signed = { key: string; uploadUrl: string; url: string };

/** Uploads blobs straight to storage and returns their keys and public URLs. */
export async function uploadBlobs(channelId: string, blobs: Blob2[], onProgress?: (fraction: number) => void): Promise<Signed[]> {
  const signed = await api<Signed[]>('/api/uploads', {
    method: 'POST',
    body: { channelId, files: blobs.map((b) => ({ name: b.name, type: b.blob.type || 'application/octet-stream', size: b.blob.size })) },
  });
  const total = blobs.reduce((n, b) => n + b.blob.size, 0) || 1;
  const loaded = blobs.map(() => 0);
  await Promise.all(
    blobs.map((b, i) =>
      put(signed[i].uploadUrl, b.blob, (n) => {
        loaded[i] = n;
        onProgress?.(loaded.reduce((a, c) => a + c, 0) / total);
      }),
    ),
  );
  return signed;
}

/** Prepared file → uploaded → item input ready for POST /api/channels/:id/items. */
export async function uploadPrepared(channelId: string, p: Prepared, onProgress?: (f: number) => void): Promise<ItemInput> {
  const blobs = p.thumb ? [p.main, p.thumb] : [p.main];
  const [main, thumb] = await uploadBlobs(channelId, blobs, onProgress);
  return { ...p.input, url: main.url, thumbUrl: thumb?.url ?? null };
}
