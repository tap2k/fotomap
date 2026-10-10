// Import one project (and its sub-projects) from a running old Fotomap/Strapi server through its
// public API — no database access needed. Users and editors aren't public, so one owner is given.
//
//   npm run import:channel -- --from https://old-host/strapi --channel bihar --owner you@example.org \
//     [--settings scripts/presets/bihar.json] [--domain bihar.example.org]

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db, channels } from '../lib/db';
import { apiToSnapshot, transformStrapi } from '../lib/migrate-strapi';
import { channelSettingsSchema } from '../lib/types';
import { insertMigrated } from './insert-migrated';
import { storage } from '../lib/storage';
import { newId } from '../lib/crypto';
import { mimeFromName } from '../lib/mime';
import { fileKeyPrefix } from '../lib/items';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function fetchTree(base: string, uniqueID: string, parentId?: number): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${base}/api/getChannel?uniqueID=${encodeURIComponent(uniqueID)}`);
  if (!res.ok) throw new Error(`Could not fetch ${uniqueID}: ${res.status}`);
  const channel = { ...(await res.json()), parentId };
  const children = (channel.children ?? []) as { uniqueID: string }[];
  const nested = await Promise.all(children.map((c) => fetchTree(base, c.uniqueID, channel.id)));
  return [channel, ...nested.flat()];
}

async function main() {
  const from = arg('from')?.replace(/\/$/, '');
  const slug = arg('channel');
  const owner = arg('owner');
  if (!from || !slug || !owner) throw new Error('Usage: --from <strapi url> --channel <uniqueID> --owner <email>');

  const [exists] = await db.select({ id: channels.id }).from(channels).where(eq(channels.slug, slug));
  if (exists) throw new Error(`A project with the slug "${slug}" already exists`);

  const tree = await fetchTree(from, slug);
  const out = transformStrapi(apiToSnapshot(tree, owner.toLowerCase()));
  await insertMigrated(out);

  const root = out.channels.find((c) => c.slug === slug)!;
  const presetFile = arg('settings');
  const raw = presetFile ? JSON.parse(readFileSync(presetFile, 'utf8')) : {};
  const preset = channelSettingsSchema.parse(presetFile ? await uploadAssets(raw, path.dirname(presetFile), root.id) : {});
  await db
    .update(channels)
    .set({ settings: { ...root.settings, ...preset }, ...(arg('domain') && { domain: arg('domain')!.toLowerCase() }) })
    .where(eq(channels.id, root.id));

  console.log(`Imported "${root.title}": ${out.channels.length} project(s), ${out.items.length} items. Owner: ${owner}`);
  for (const w of out.warnings) console.log(`  ! ${w}`);
}

/** Replaces "file:relative/path" strings in a preset with uploaded files in the project's storage. */
async function uploadAssets(value: unknown, dir: string, channelId: string): Promise<unknown> {
  if (typeof value === 'string' && value.startsWith('file:')) {
    const file = path.resolve(dir, value.slice(5));
    const key = `${fileKeyPrefix(channelId)}${newId(16)}${path.extname(file).toLowerCase()}`;
    await storage.put(key, readFileSync(file), mimeFromName(file));
    return storage.publicUrl(key);
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => uploadAssets(v, dir, channelId)));
  if (value && typeof value === 'object')
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await uploadAssets(v, dir, channelId)])));
  return value;
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err.message ?? err);
    process.exit(1);
  },
);
