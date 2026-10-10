import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

/** Random id from an unambiguous alphabet. 12 chars ≈ 70 bits. */
export function newId(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Unguessable secret for share links and sessions. */
export const newToken = () => randomBytes(24).toString('base64url');

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function secret() {
  const s = process.env.SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('SECRET is not set');
  return s ?? 'dev-secret';
}

export const sign = (s: string) => createHmac('sha256', secret()).update(s).digest('base64url');

export function verify(s: string, sig: string): boolean {
  const a = Buffer.from(sign(s));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
