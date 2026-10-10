import { createReadStream, createWriteStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { verify } from '@/lib/crypto';
import { mimeFromName } from '@/lib/mime';
import { ensureLocalDir, isLocalStorage, localPath } from '@/lib/storage';

// Local storage driver only: serves and receives files under .data/uploads.
// Keys are unguessable, like objects in a public S3 bucket.

type Ctx = { params: Promise<{ key: string[] }> };

export async function GET(req: Request, { params }: Ctx) {
  if (!isLocalStorage) return new Response('Not found', { status: 404 });
  const key = (await params).key.join('/');
  let file: string, size: number;
  try {
    file = localPath(key);
    size = (await stat(file)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const type = mimeFromName(key);
  const headers: Record<string, string> = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
  // Range requests let browsers seek in video and audio.
  const range = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, 'Content-Length': String(size) } });
}

export async function PUT(req: Request, { params }: Ctx) {
  if (!isLocalStorage) return new Response('Not found', { status: 404 });
  const key = (await params).key.join('/');
  const url = new URL(req.url);
  const exp = Number(url.searchParams.get('exp'));
  const size = Number(url.searchParams.get('size'));
  const type = req.headers.get('content-type') ?? '';
  if (!exp || exp < Date.now() / 1000 || !verify(`${key}:${exp}:${type}:${size}`, url.searchParams.get('sig') ?? ''))
    return new Response('Forbidden', { status: 403 });
  if (!req.body) return new Response('Empty', { status: 400 });
  const file = localPath(key);
  await ensureLocalDir(file);
  // Stream to disk; stop as soon as the upload exceeds the signed size.
  let received = 0;
  const limit = new Transform({
    transform(chunk, _enc, done) {
      received += chunk.length;
      done(received > size ? new Error('Too large') : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(req.body as import('node:stream/web').ReadableStream), limit, createWriteStream(file));
  } catch {
    await unlink(file).catch(() => {});
    return new Response('Upload rejected', { status: 413 });
  }
  return new Response(null, { status: 200 });
}
