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

test('collect → review → publish → view → export', async ({ page, browser }) => {
  await signIn(page, 'researcher@example.org');
  await expect(page.getByRole('heading', { name: 'Your channels' })).toBeVisible();

  // Create a channel.
  await page.getByPlaceholder(/Title, e.g./).fill('Neighbourhood Voices');
  await page.getByRole('button', { name: 'New channel' }).click();
  await page.waitForURL(/\/edit\//);
  const channelId = page.url().split('/edit/')[1];

  // Upload a geotagged photo: location comes from EXIF, resized in the browser.
  await page.locator('input[type=file][multiple]').setInputFiles(path.join(import.meta.dirname, 'fixtures/london.jpg'));
  const row = page.locator('li', { hasText: 'Untitled image' });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByTitle('Has location')).toBeVisible();

  // Edit it.
  await row.locator('button').nth(1).click();
  await page.getByText('Title', { exact: true }).locator('..').locator('input').fill('Big Ben');
  await page.getByText('Tags (comma separated)').locator('..').locator('input').fill('landmark, tourism');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('li', { hasText: 'Big Ben' })).toBeVisible();

  // Ask contributors for consent.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByPlaceholder(/I agree that my contribution/).fill('I agree my contribution may be published.');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  // Create a submission link.
  await page.getByRole('button', { name: 'Sharing' }).click();
  await page.getByRole('button', { name: 'New submission link' }).click();
  const submitUrl = await page.locator('input[readonly]').first().inputValue();
  expect(submitUrl).toMatch(/\/s\//);

  // An anonymous contributor sends a text note.
  const anon = await browser.newContext();
  const guest = await anon.newPage();
  await guest.goto(submitUrl);
  await expect(guest.getByRole('heading', { name: 'Neighbourhood Voices' })).toBeVisible();
  await guest.getByRole('button', { name: 'Text' }).click();
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
  await page.getByRole('button', { name: /Review \(1\)/ }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('button', { name: 'Review', exact: true })).toBeVisible();

  // Published views.
  await guest.goto(`/c/${slug}/reel?i=1`);
  await expect(guest.getByText('The bakery on the corner closed last year.')).toBeVisible();
  await guest.goto(`/c/${slug}/story`);
  await expect(guest.getByRole('heading', { name: 'Big Ben' })).toBeVisible();
  await guest.goto(`/embed/${slug}/grid`);
  await expect(guest.getByText('Neighbourhood Voices · Fotomap')).toBeVisible();
  await guest.goto(`/c/${slug}/map`);
  await expect(guest.locator('canvas.maplibregl-canvas, .maplibregl-map').first()).toBeAttached();

  // Export.
  const csv = await (await page.request.get(`/api/channels/${channelId}/export?format=csv`)).text();
  expect(csv).toContain('Big Ben');
  expect(csv).toContain('landmark;tourism');
  expect(csv).toMatch(/51\.50\d+/);
  const geo = await (await page.request.get(`/api/channels/${channelId}/export?format=geojson`)).json();
  expect(geo.features).toHaveLength(1);

  await anon.close();
});
