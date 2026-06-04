/**
 * Record the yacht-tinder demo → docs/demo.gif
 *
 *   node scripts/record-demo.mjs          # expects the app at http://localhost:3000
 *
 * Same engine pagecast uses (Playwright video + two-pass ffmpeg palette → GIF).
 * Drives Discover (swipe) → Search → Saved, with a visible cursor overlay.
 */
import { chromium } from 'playwright';
import { mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const URL = process.env.DEMO_URL || 'http://localhost:3000';
const OUT_DIR = resolve(ROOT, 'docs');
const VID_DIR = resolve(ROOT, '.recordings');
const W = 440;
const H = 900;
// Defaults reproduce the FULL capture quality (~9-10 MB). For a smaller, optimized
// GIF set the DEMO_* env vars, e.g.:
//   DEMO_WIDTH=320 DEMO_FPS=12 DEMO_DENOISE=8:6:12:12 DEMO_TRIM=1 DEMO_MAXCOLORS=160 \
//     node scripts/record-demo.mjs
const FPS = Number(process.env.DEMO_FPS || 13);
const GIF_WIDTH = Number(process.env.DEMO_WIDTH || 380);
const TRIM_START = Number(process.env.DEMO_TRIM || 0); // seconds dropped from the front
const DENOISE = process.env.DEMO_DENOISE || ''; // '' = no denoise (full quality)
const MAX_COLORS = Number(process.env.DEMO_MAXCOLORS || 256);
const BAYER = Number(process.env.DEMO_BAYER || 3);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A soft brass cursor dot that follows the pointer, so clicks/drags read clearly.
const CURSOR = `(() => {
  const d = document.createElement('div');
  d.id = '__democursor';
  d.style.cssText = 'position:fixed;z-index:2147483647;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:radial-gradient(circle,rgba(236,210,150,.95) 0%,rgba(199,154,75,.45) 55%,transparent 72%);box-shadow:0 0 16px rgba(236,210,150,.85);pointer-events:none;left:-100px;top:-100px;transition:transform .08s ease;';
  const add = () => document.body && document.body.appendChild(d);
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { d.style.transform = 'scale(.6)'; }, true);
  addEventListener('mouseup', () => { d.style.transform = 'scale(1)'; }, true);
})();`;

async function warm() {
  // Pre-compile routes + load the embedding model so the in-recording search is
  // instant (no spinner pause in the GIF). Retry until /api/search returns 200,
  // since the first call also compiles the route and downloads/loads the model.
  await fetch(URL).catch(() => {}); // compile the home route (avoid dead time on screen)
  await fetch(`${URL}/api/recommend`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ likedIds: [], dislikedIds: [], limit: 5 }),
  }).catch(() => {});

  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${URL}/api/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'sailing yacht in greece with jet skis', limit: 4 }),
      });
      if (res.ok) {
        await res.json();
        console.log(`  model warm after ${i + 1} attempt(s)`);
        return;
      }
    } catch {
      /* keep retrying */
    }
    await sleep(1500);
  }
  console.warn('  warmup did not confirm a 200 — recording anyway');
}

async function main() {
  console.log('Warming the app (route compile + model load)…');
  await warm();

  rmSync(VID_DIR, { recursive: true, force: true });
  mkdirSync(VID_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: VID_DIR, size: { width: W, height: H } },
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();

  const cx = W / 2;
  const cy = 320;
  async function drag(dx, dy, steps = 20) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps);
      await sleep(11);
    }
    await page.mouse.up();
  }

  // --- Discover --------------------------------------------------------------
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 20000 });
  await sleep(1500);

  await drag(235, -10); // swipe right → like
  await sleep(1150);
  await drag(-245, 10); // swipe left → pass
  await sleep(1150);
  await page.click('button[aria-label="Save to shortlist"]'); // like via anchor button
  await sleep(1150);
  await drag(238, -8); // swipe right → like
  await sleep(1150);

  // --- Search ----------------------------------------------------------------
  await page.click('a[href="/search"]');
  await page.waitForSelector('button.chip', { timeout: 8000 });
  await sleep(900);
  await page.click('button.chip'); // first example query
  await page.waitForSelector('.row', { timeout: 20000 });
  await sleep(1600);
  await page.mouse.wheel(0, 280);
  await sleep(1500);
  await page.mouse.wheel(0, 280);
  await sleep(1500);

  // --- Saved -----------------------------------------------------------------
  await page.click('a[href="/saved"]');
  await page.waitForSelector('.berth, .empty', { timeout: 8000 });
  await sleep(2400);

  await context.close(); // finalizes the .webm
  await browser.close();

  // --- webm → optimized GIF (two-pass palette) -------------------------------
  const webm = readdirSync(VID_DIR)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => resolve(VID_DIR, f))[0];
  if (!webm) throw new Error('no video was produced');
  const gif = resolve(OUT_DIR, 'demo.gif');

  // Single-pass: (optional denoise) → split → palettegen → paletteuse.
  console.log('Encoding GIF…');
  const dn = DENOISE ? `,hqdn3d=${DENOISE}` : '';
  const ss = TRIM_START > 0 ? `-ss ${TRIM_START} ` : '';
  const fc =
    `[0:v]fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos${dn},split[a][b];` +
    `[a]palettegen=max_colors=${MAX_COLORS}:stats_mode=diff[p];` +
    `[b][p]paletteuse=dither=bayer:bayer_scale=${BAYER}`;
  execSync(`ffmpeg -y ${ss}-i "${webm}" -filter_complex "${fc}" "${gif}"`, { stdio: 'inherit' });
  console.log(`\n✓ Wrote ${gif}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
