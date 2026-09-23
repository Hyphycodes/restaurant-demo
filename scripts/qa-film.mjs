// Films a route at chosen scroll positions (with motion on) for visual QA.
// QA_URL=http://localhost:3100 R=/ STOPS=0,900,2400 node scripts/qa-film.mjs
import { chromium } from '@playwright/test';
const origin = process.env.QA_URL || 'http://localhost:3100';
const route = process.env.R || '/';
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
const stops = (process.env.STOPS || '0').split(',').map(Number);
const tag = process.env.TAG || 'film';
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 700, isMobile: W < 700, reducedMotion: process.env.RM || 'no-preference' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); }); page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
await page.goto(origin + route, { waitUntil: 'load' });
await page.waitForTimeout(+(process.env.WAIT || 4200));
const total = await page.evaluate(() => document.documentElement.scrollHeight);
console.log('height', total);
for (const s of stops) {
  const y = s;
  await page.evaluate(async (y) => { const cur = scrollY; const steps = 14; for (let i = 1; i <= steps; i++) { scrollTo(0, cur + (y - cur) * i / steps); await new Promise((r) => setTimeout(r, 45)); } }, y);
  await page.waitForTimeout(+(process.env.SETTLE || 1600));
  const name = `/tmp/claude-0/shots/${tag}-${W}-${y}.png`;
  await page.screenshot({ path: name, fullPage: process.env.FULL === '1' });
  console.log(name);
}
await browser.close();
