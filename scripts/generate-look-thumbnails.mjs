/**
 * Real screenshots of the site in each look, for the preset cards on
 * /admin/look. Runs against a dev server with the local database, signed in
 * as the local owner, and writes public/admin/looks/<preset>.jpg.
 *
 *   QA_URL=http://localhost:3000 node scripts/generate-look-thumbnails.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const origin = process.env.QA_URL || 'http://127.0.0.1:3000';
const presets = ['evening', 'aperitivo', 'nocturne', 'daylight'];
await mkdir('public/admin/looks', { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1.5, reducedMotion: 'reduce' });
await context.addCookies([{ name: 'cosa-nostra_local_staff', value: 'owner', domain: new URL(origin).hostname, path: '/' }]);
const page = await context.newPage();

for (const preset of presets) {
  // A fresh load per preset: the page's own saved look is the baseline every time.
  const response = await page.goto(`${origin}/look-preview/events?plain=1`, { waitUntil: 'networkidle' });
  if (!response || response.status() !== 200) throw new Error(`preview ${response?.status()} at ${page.url()}`);
  // Only after hydration: React rebuilds the root element while hydrating and
  // would drop inline variables set before it finished.
  await page.waitForSelector('html[data-preview-ready]', { timeout: 20_000 });
  const vars = await page.evaluate(async (name) => {
    const reply = await fetch(`/api/admin/look-vars?preset=${name}`);
    const values = await reply.json();
    for (const [key, value] of Object.entries(values)) document.documentElement.style.setProperty(key, value);
    return { surface: values['--color-ivory'], body: getComputedStyle(document.body).backgroundColor };
  }, preset);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `public/admin/looks/${preset}.jpg`, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 640, height: 400 } });
  console.log(`wrote public/admin/looks/${preset}.jpg  surface ${vars.surface} → body ${vars.body}`);
}
await browser.close();
