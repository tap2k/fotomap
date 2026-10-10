import { z } from 'zod';
import { route, fail } from '@/lib/http';
import { requireChannel } from '@/lib/access';
import { assertAllowed } from '@/lib/plans';
import { newId } from '@/lib/crypto';
import { storage } from '@/lib/storage';
import { fileKeyPrefix } from '@/lib/items';

const ALLOWED = /^(image|video|audio)\//;

/** Step 1 of every upload: get a signed URL the browser PUTs the file to directly. */
export const POST = route(async (req) => {
  const { channelId, files } = z
    .object({
      channelId: z.string(),
      files: z
        .array(z.object({ name: z.string().max(300), type: z.string().max(100), size: z.number().int().positive() }))
        .min(1)
        .max(20),
    })
    .parse(await req.json());
  const { channel } = await requireChannel(channelId, 'submit');
  for (const f of files) {
    if (!ALLOWED.test(f.type)) fail(415, `Unsupported file type: ${f.type}`);
    await assertAllowed(channel.ownerId, { type: 'upload', bytes: f.size });
  }
  return Promise.all(
    files.map(async (f) => {
      const ext = (f.name.match(/\.[a-z0-9]{1,5}$/i)?.[0] ?? '').toLowerCase();
      const key = `${fileKeyPrefix(channel.id)}${newId(16)}${ext}`;
      return { key, uploadUrl: await storage.uploadUrl(key, f.type), url: storage.publicUrl(key) };
    }),
  );
});
