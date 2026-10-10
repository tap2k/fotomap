import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@libsql/client';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';

const db = createClient({ url: process.env.E2E_DB! });

/** Signs in by planting a login token, exactly as the emailed magic link would. */
async function signIn(page: Page, email: string) {
  const token = randomBytes(24).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await db.execute({ sql: 'INSERT INTO login_tokens (id, email, expires_at) VALUES (?, ?, ?)', args: [hash, email, Math.floor(Date.now() / 1000) + 600] });
  await page.goto(`/api/auth/verify?token=${token}&next=/`);
}

const saved = (page: Page) => expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });

test('collect → review → publish → view → export', async ({ page, browser }) => {
  await signIn(page, 'researcher@example.org');
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();

  // Create a project from the Photovoice template.
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByRole('button', { name: /Photovoice/ }).click();
  await page.getByPlaceholder('Name your photovoice').fill('Neighbourhood Voices');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/edit\//);
  const channelId = page.url().split('/edit/')[1];
  await expect(page.getByText('Add your media')).toBeVisible(); // first-run guide

  // Upload a geotagged photo: location comes from EXIF, resized in the browser.
  await page.locator('input[type=file][multiple]').setInputFiles(path.join(import.meta.dirname, 'fixtures/london.jpg'));
  const card = page.locator('ul li').filter({ hasText: 'Untitled' }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByTitle('No location')).toHaveCount(0);

  // Edit it in the side panel: changes autosave.
  await card.getByRole('button', { name: /Untitled/ }).click();
  await page.getByPlaceholder('Give it a title').fill('Big Ben');
  await page.getByLabel('Add tag').fill('landmark');
  await page.getByLabel('Add tag').press('Enter');
  await page.getByLabel('Add tag').fill('tourism');
  await page.getByLabel('Add tag').press('Enter');
  await saved(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('ul li', { hasText: 'Big Ben' })).toBeVisible();

  // The template pre-filled consent; open contributions.
  await page.getByRole('tab', { name: /Collect/ }).click();
  await expect(page.getByPlaceholder(/Optional. If set/)).toHaveValue(/I took this photo/);
  await page.getByRole('switch').click();
  await expect(page.getByRole('switch')).toBeChecked();
  const submitUrl = await page.getByLabel('Contribution link').inputValue();
  expect(submitUrl).toMatch(/\/s\//);

  // An anonymous contributor sends a text note.
  const anon = await browser.newContext();
  const guest = await anon.newPage();
  await guest.goto(submitUrl);
  await expect(guest.getByRole('heading', { name: 'Neighbourhood Voices' })).toBeVisible();
  await guest.getByRole('button', { name: 'Write' }).click();
  await guest.getByPlaceholder('Write something…').fill('The bakery on the corner closed last year.');
  await guest.getByRole('button', { name: 'Add', exact: true }).click();
  const send = guest.getByRole('button', { name: /Send 1 item/ });
  await expect(send).toBeDisabled(); // consent not given yet
  await guest.getByRole('checkbox').check();
  await send.click();
  await expect(guest.getByText('Thank you!')).toBeVisible();

  // Strangers can't edit.
  const res = await guest.request.patch('/api/items', { data: { items: [{ id: 'x', title: 'hack' }] } });
  expect(res.status()).toBe(404);
  await guest.goto(`/edit/${channelId}`);
  await expect(guest).toHaveURL(/\/login/);

  // Pending items stay hidden until approved.
  const slug = await page.evaluate(async (id) => (await (await fetch(`/api/channels/${id}`)).json()).slug, channelId);
  await guest.goto(`/c/${slug}/grid`);
  await expect(guest.getByText('Big Ben')).toBeVisible();
  await expect(guest.getByText('bakery')).toHaveCount(0);

  await page.reload();
  await page.getByRole('tab', { name: /Inbox/ }).click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('No contributions waiting')).toBeVisible();
  await saved(page);

  // Share dialog: the project is viewable by link.
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByLabel('View link')).toHaveValue(new RegExp(`/c/${slug}$`));
  await page.keyboard.press('Escape');

  // Published views.
  await guest.goto(`/c/${slug}/reel?i=1`);
  await expect(guest.getByText('The bakery on the corner closed last year.')).toBeVisible();
  await guest.goto(`/c/${slug}/story`);
  await expect(guest.getByRole('heading', { name: 'Big Ben' })).toBeVisible();
  await guest.goto(`/embed/${slug}/grid`);
  await expect(guest.getByText('Neighbourhood Voices · Fotomap')).toBeVisible();
  await guest.goto(`/c/${slug}/map`);
  await expect(guest.locator('.maplibregl-map').first()).toBeAttached();

  // Export.
  const csv = await (await page.request.get(`/api/channels/${channelId}/export?format=csv`)).text();
  expect(csv).toContain('Big Ben');
  expect(csv).toContain('landmark;tourism');
  expect(csv).toMatch(/51\.50\d+/);
  const geo = await (await page.request.get(`/api/channels/${channelId}/export?format=geojson`)).json();
  expect(geo.features).toHaveLength(1);

  await anon.close();
});
