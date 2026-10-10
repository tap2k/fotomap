// Records the getting-started walkthrough video and the screenshots used on /guide.
//
//   npm run build && DATABASE_URL=file:.data/guide.db npm start -- -p 3200   (fresh, empty database)
//   GUIDE_DB=.data/guide.db npm run guide:record
//
// Writes public/guide/getting-started.mp4 (+ poster) and public/guide/*.jpg.
// Set PLAYWRIGHT_CHROMIUM_PATH if Playwright's own browser isn't installed.

import { chromium } from '@playwright/test';
import { createClient } from '@libsql/client';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.GUIDE_URL ?? 'http://localhost:3200';
const DB = process.env.GUIDE_DB ?? '.data/guide.db';
const OUT = path.resolve('public/guide');
const PHOTOS = path.resolve('scripts/guide/photos');
const TMP = path.resolve('.data/guide-video');
const EMAIL = 'guide@example.org';
const size = { width: 1280, height: 720 };

mkdirSync(OUT, { recursive: true });
rmSync(TMP, { recursive: true, force: true });

// Captions and a visible cursor (video recordings don't show the real one).
const overlay = () => {
  const style = document.createElement('style');
  style.textContent = `
    #guide-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
      background:rgba(228,87,46,.35);border:2px solid rgba(228,87,46,.9);pointer-events:none;transition:transform .1s}
    #guide-cursor.down{transform:scale(.7)}
    #guide-caption.top{top:20px;bottom:auto}
    #guide-caption{position:fixed;z-index:2147483646;left:50%;bottom:28px;transform:translateX(-50%);max-width:80%;
      padding:12px 22px;border-radius:14px;background:rgba(17,20,23,.86);color:#fff;font:500 22px/1.35 system-ui,sans-serif;
      text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.3);transition:opacity .3s;pointer-events:none}`;
  const add = () => {
    document.head.appendChild(style);
    const c = document.createElement('div');
    c.id = 'guide-cursor';
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => c.classList.add('down'), true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
    const saved = sessionStorage.getItem('guide-caption');
    if (saved) window.__caption(saved);
  };
  window.__caption = (text, top) => {
    sessionStorage.setItem('guide-caption', text || '');
    let el = document.getElementById('guide-caption');
    if (!text) return el?.remove();
    if (!el) { el = document.createElement('div'); el.id = 'guide-caption'; document.body.appendChild(el); }
    el.textContent = text;
    el.classList.toggle('top', !!top);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add);
  else add();
};

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: size, recordVideo: { dir: TMP, size } });
await context.addInitScript(overlay);
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const page = await context.newPage();
page.setDefaultTimeout(20_000);

const wait = (ms) => page.waitForTimeout(ms);
const caption = async (text, ms = 2600, top = false) => {
  await page.evaluate(([t, p]) => window.__caption(t, p), [text, top]);
  await wait(ms);
};
// Stills for /guide, without the caption and cursor (the page text explains each step).
const shot = async (name) => {
  await page.addStyleTag({ content: '#guide-caption,#guide-cursor{visibility:hidden!important}' }).then((h) => h.evaluate((el) => el.setAttribute('data-shot', '')));
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 });
  await page.evaluate(() => document.querySelectorAll('style[data-shot]').forEach((el) => el.remove()));
};
const type = (locator, text) => locator.pressSequentially(text, { delay: 35 });

// 1. Landing and sign-in
await page.goto(BASE);
await caption('Fotomap: collect photos, video and voices — and share them as maps and stories.', 3200);
await page.getByRole('link', { name: 'Sign in' }).first().click();
await type(page.getByLabel('Email'), EMAIL);
await caption('Sign in with just your email. No password to remember.', 1500);
await page.getByRole('button', { name: /Email me a sign-in link/ }).click();
await wait(1500);
const token = randomBytes(24).toString('base64url');
await createClient({ url: `file:${DB}` }).execute({
  sql: 'INSERT INTO login_tokens (id, email, expires_at) VALUES (?, ?, ?)',
  args: [createHash('sha256').update(token).digest('hex'), EMAIL, Math.floor(Date.now() / 1000) + 600],
});
await page.goto(`${BASE}/api/auth/verify?token=${token}&next=/`); // what the emailed link does

// 2. New project from a template
await caption('Start a new project from a template.', 1800);
await page.getByRole('button', { name: 'New project' }).first().click();
await wait(600);
await page.getByRole('button', { name: /Participatory map/ }).click();
await shot('new-project');
await type(page.getByPlaceholder(/Name your/), 'Favourite Trails');
await wait(400);
await page.getByRole('button', { name: 'Create' }).click();
await page.waitForURL(/\/edit\//);
const editUrl = page.url();

// 3. Upload
await caption('Add photos, video or audio. Locations and dates are read from the photos.', 1200);
await page.locator('input[type=file][multiple]').setInputFiles(readdirSync(PHOTOS).sort().map((f) => path.join(PHOTOS, f)));
await page.locator('ul li').nth(5).waitFor();
await wait(2500);
await shot('content');

// 4. Caption and tag
await caption('Click any item to add a title, a caption and tags. Everything saves as you go.', 800);
await page.locator('ul li').first().getByRole('button').first().click();
await wait(1500);
await type(page.getByPlaceholder('Give it a title'), 'Above the fjord');
await type(page.getByPlaceholder(/What does it show/), 'Two hours up, worth every step.');
await type(page.getByLabel('Add tag'), 'mountains');
await page.getByLabel('Add tag').press('Enter');
await wait(1600);
await shot('item');
await page.getByRole('button', { name: 'Next item' }).click();
await wait(800);
await type(page.getByPlaceholder('Give it a title'), 'Ridge walk in the mist');
await page.getByRole('button', { name: '+ mountains' }).click();
await wait(1200);
await page.getByRole('button', { name: 'Done' }).click();

// 5. Collect
await page.getByRole('tab', { name: /Collect/ }).click();
await caption('Turn on contributions to get a link and a QR code.', 1200);
await page.getByRole('switch').click();
await page.getByLabel('Contribution link').waitFor();
await wait(2200);
await shot('collect');
const submitUrl = await page.getByLabel('Contribution link').inputValue();

// 6. A contributor
await page.goto(submitUrl);
await caption('Contributors use the link on their phones. No account needed.', 1500, true);
await page.getByRole('button', { name: 'Write' }).click();
await type(page.getByPlaceholder('Write something…'), 'The path past the old mill is open again after the storm.');
await page.getByRole('button', { name: 'Add', exact: true }).click();
await wait(500);
const consent = page.getByRole('checkbox');
if (await consent.count()) await consent.first().check();
await shot('contribute');
await page.getByRole('button', { name: /Send 1 item/ }).click();
await page.getByText('Thank you!').waitFor();
await wait(1500);

// 7. Review
await page.goto(editUrl);
await page.getByRole('tab', { name: /Inbox/ }).click();
await caption('New contributions wait in your Inbox. Nothing is public until you approve it.', 1500);
await shot('inbox');
await page.getByRole('button', { name: 'Approve', exact: true }).click();
await wait(1500);

// 8. Design
await page.getByRole('tab', { name: /Design/ }).click();
await caption('Choose how it opens and how it looks.', 1000);
await page.getByRole('button', { name: /^Story/ }).click();
await wait(700);
await page.getByRole('button', { name: /^ocean/i }).click();
await wait(1500);
await shot('design');

// 9. Share
await page.getByRole('button', { name: 'Share' }).click();
await caption('Share a link or QR code, embed it on a website, or invite collaborators.', 2800);
await shot('share');
await page.keyboard.press('Escape');
await wait(800); // let autosave finish
const slug = await page.evaluate(async () => (await (await fetch(`/api/channels/${location.pathname.split('/').pop()}`)).json()).slug);

// 10. The result
await page.goto(`${BASE}/c/${slug}/story`);
await caption('Your project as a scrolling story…', 2200);
for (let i = 0; i < 4; i++) {
  await page.mouse.wheel(0, 650);
  await wait(1300);
}
await shot('story');
await page.goto(`${BASE}/c/${slug}/map`);
await caption('…a map…', 3000);
await shot('map');
await page.goto(`${BASE}/c/${slug}/grid`);
await caption('…a grid, or a slideshow.', 2200);
await page.goto(`${BASE}/c/${slug}/reel`);
await wait(2500);
await caption('Get started — it’s free and open source.', 3000);

const video = await page.video().path();
await context.close();
await browser.close();

// webm → mp4 (H.264) for every browser; poster from the opening frame.
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `${OUT}/getting-started.mp4`]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2', '-i', video, '-frames:v', '1', '-q:v', '4', `${OUT}/getting-started-poster.jpg`]);
renameSync(video, path.join(TMP, 'last.webm'));
console.log(`Wrote ${OUT}/getting-started.mp4 and screenshots`);
