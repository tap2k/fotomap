import { createReadStream } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { verify } from '@/lib/crypto';
import { mimeFromName } from '@/lib/mime';
import { ensureLocalDir, isLocalStorage, localPath } from '@/lib/storage';

// Local storage driver only: serves and receives files under .data/uploads.
// Keys are unguessable, like objects in a public S3 bucket.

type Ctx = { params: Promise<{ key: string[] }> };
const MAX_LOCAL_UPLOAD = 1024 * 1024 * 1024;

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
  const type = req.headers.get('content-type') ?? '';
  if (!exp || exp < Date.now() / 1000 || !verify(`${key}:${exp}:${type}`, url.searchParams.get('sig') ?? ''))
    return new Response('Forbidden', { status: 403 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > MAX_LOCAL_UPLOAD) return new Response('Too large', { status: 413 });
  const file = localPath(key);
  await ensureLocalDir(file);
  await writeFile(file, body);
  return new Response(null, { status: 200 });
}
