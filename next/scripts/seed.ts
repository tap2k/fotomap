// Demo data for local development: `npm run seed`, then sign in as demo@example.org.
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { generateKeyBetween } from 'fractional-indexing';
import { eq } from 'drizzle-orm';
import { db, users, channels, items, grants } from '../lib/db';
import { newId } from '../lib/crypto';

const PLACES: [string, number, number, string[]][] = [
  ['Market hall', 51.5145, -0.0755, ['food', 'community']],
  ['River walk', 51.5079, -0.0877, ['nature']],
  ['Old bakery', 51.5226, -0.0784, ['food', 'memory']],
  ['Community garden', 51.5294, -0.0575, ['nature', 'community']],
  ['Youth club', 51.5167, -0.0598, ['community']],
  ['Bus stop mural', 51.5212, -0.0985, ['art']],
];

async function main() {
  const email = 'demo@example.org';
  let [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) [user] = await db.insert(users).values({ id: newId(), email, name: 'Demo' }).returning();

  const id = newId();
  await db.insert(channels).values({
    id,
    slug: newId(8),
    ownerId: user.id,
    title: 'Neighbourhood Voices',
    description: 'A photovoice project: residents photograph the places that matter to them and say why.',
    visibility: 'public',
    settings: {
      theme: 'paper',
      defaultView: 'map',
      tagColors: { food: '#d9542b', nature: '#3d7a3a', community: '#1a5f7a', art: '#8a4fbf', memory: '#c9a227' },
      submissions: { prompt: 'Share a photo of a place that matters to you, and tell us why.', askName: true, locationPrecision: 'approximate' },
    },
  });
  await db.insert(grants).values({ id: newId(), channelId: id, role: 'owner', userId: user.id });

  const dir = path.resolve('.data/uploads/c', id);
  await mkdir(dir, { recursive: true });
  let position: string | null = null;
  for (const [title, lat, lng, tags] of PLACES) {
    const file = `${newId(16)}.jpg`;
    await copyFile('tests/e2e/fixtures/london.jpg', path.join(dir, file));
    position = generateKeyBetween(position, null);
    await db.insert(items).values({
      id: newId(),
      channelId: id,
      position,
      kind: 'image',
      url: `/api/files/c/${id}/${file}`,
      fileKeys: [`c/${id}/${file}`],
      title,
      caption: `Why ${title.toLowerCase()} matters: it's where neighbours meet.\n\nRecorded during the spring walkabout.`,
      tags,
      lat,
      lng,
      meta: { contributor: { name: 'Resident' } },
    });
  }
  console.log(`Seeded "Neighbourhood Voices" (${id}). Sign in as ${email}.`);
}

main().then(() => process.exit(0));
