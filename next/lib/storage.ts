import { mkdir, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sign } from '@/lib/crypto';
import { appUrl } from '@/lib/auth';

// One interface, two drivers: any S3-compatible bucket (R2, B2, MinIO, AWS) or a local folder.
export interface Storage {
  /** URL the browser PUTs the file to. */
  uploadUrl(key: string, contentType: string, size: number): Promise<string>;
  /** Public URL for reading. */
  publicUrl(key: string): string;
  /** Actual stored size in bytes, or null if missing. */
  size(key: string): Promise<number | null>;
  remove(keys: string[]): Promise<void>;
  /** Deletes everything under a prefix (a whole channel's files). */
  removePrefix(prefix: string): Promise<void>;
}

export const LOCAL_ROOT = path.resolve('.data/uploads');
const UPLOAD_TTL = 3600;

/** Resolves a key inside LOCAL_ROOT, rejecting path traversal. */
export function localPath(key: string) {
  const p = path.resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error('Bad key');
  return p;
}

const local: Storage = {
  async uploadUrl(key, contentType, size) {
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL;
    const sig = sign(`${key}:${exp}:${contentType}:${size}`);
    return `/api/files/${key}?exp=${exp}&size=${size}&sig=${sig}`;
  },
  publicUrl: (key) => `/api/files/${key}`,
  async size(key) {
    try {
      return (await stat(localPath(key))).size;
    } catch {
      return null;
    }
  },
  async remove(keys) {
    await Promise.all(keys.map((k) => unlink(localPath(k)).catch(() => {})));
  },
  async removePrefix(prefix) {
    await rm(localPath(prefix), { recursive: true, force: true });
  },
};

function s3Storage(): Storage {
  const bucket = process.env.S3_BUCKET!;
  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! }
      : undefined,
  });
  const base = (process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT}/${bucket}`).replace(/\/$/, '');
  return {
    // ContentLength is signed, so the browser must upload exactly the size it declared.
    uploadUrl: (key, contentType, size) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }), {
        expiresIn: UPLOAD_TTL,
        signableHeaders: new Set(['content-length', 'content-type']),
      }),
    publicUrl: (key) => `${base}/${key}`,
    async size(key) {
      try {
        return (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))).ContentLength ?? null;
      } catch {
        return null;
      }
    },
    async remove(keys) {
      if (keys.length)
        await client.send(
          new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }),
        );
    },
    async removePrefix(prefix) {
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
        );
        await this.remove((page.Contents ?? []).map((o) => o.Key!));
        token = page.NextContinuationToken;
      } while (token);
    },
  };
}

export const storage: Storage = process.env.S3_BUCKET ? s3Storage() : local;
export const isLocalStorage = !process.env.S3_BUCKET;

export const ensureLocalDir = (file: string) => mkdir(path.dirname(file), { recursive: true });

/** Absolute URL for a stored or relative URL (for emails, exports, the video service). */
export const absoluteUrl = (url: string | null) => (url && url.startsWith('/') ? appUrl() + url : url);
