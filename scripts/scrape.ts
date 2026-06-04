/**
 * Playwright scraper for goolets.net yacht charters.
 *
 *   npm run scrape                 # pages 1..2 (default), ~34 yachts
 *   npm run scrape -- --pages=3    # pages 1..3
 *   npm run scrape -- --start=2 --pages=1   # only page 2
 *
 * Strategy:
 *   Phase A — walk listing pages, collect each yacht's detail URL + gallery images.
 *   Phase B — visit each detail page, parse the rich spec/price schema.
 * Output: data/yachts.json  (Yacht[])
 *
 * Notes:
 *   - Listing pages are server-rendered → use `domcontentloaded`, NOT
 *     `networkidle` (the Swiper galleries keep the network busy forever).
 *   - Sequential + jittered delays to stay polite.
 *   - Per-yacht try/catch; failures are logged and skipped, never fatal.
 */
import { chromium, type Page } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Yacht, SeasonalRate } from '../src/types/yacht.ts';
import {
  parsePriceRange,
  parseDimension,
  parseFirstInt,
  parseBuilt,
  parseWaterSports,
  parseCrew,
  parsePrice,
  slugFromUrl,
  clean,
} from './lib/parse.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const BASE = 'https://goolets.net';
const SORT = 'price_desc';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function arg(name: string, def: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return def;
  const n = parseInt(hit.split('=')[1], 10);
  return Number.isFinite(n) ? n : def;
}

const START_PAGE = arg('start', 1);
const NUM_PAGES = arg('pages', 2);
const LIMIT = arg('limit', 0); // 0 = no cap on detail pages
const DELAY_MIN = Number(process.env.SCRAPE_DELAY_MIN ?? 1500);
const DELAY_MAX = Number(process.env.SCRAPE_DELAY_MAX ?? 3500);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => DELAY_MIN + (DELAY_MAX - DELAY_MIN) * (process.hrtime()[1] % 1000) / 1000;

function listingUrl(page: number): string {
  return page <= 1
    ? `${BASE}/yacht-rentals/?sort=${SORT}`
    : `${BASE}/yacht-rentals/page/${page}/?sort=${SORT}`;
}

interface ListingItem {
  url: string;
  name: string | null;
  images: string[];
}

/** Phase A: pull yacht detail URLs + gallery images from one listing page. */
async function scrapeListingPage(page: Page, url: string): Promise<ListingItem[]> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.yacht-card-archive'));
    const items: { url: string; name: string | null; images: string[] }[] = [];
    for (const card of cards) {
      const link = (card.querySelector('a.stretched-link[href]') ??
        card.querySelector('a[href]')) as HTMLAnchorElement | null;
      const url = link ? link.href : null; // resolved absolute URL
      if (!url) continue;
      // Keep only real yacht detail pages: /yacht-rentals/<slug>/ (one segment),
      // excluding the listing root and /yacht-rentals/page/N/.
      const path = new URL(url).pathname;
      if (!/^\/yacht-rentals\/[^/]+\/?$/.test(path) || /\/page\//.test(path)) continue;

      const titleWrap = card.querySelector('.yacht-card-archive__title-wrap');
      const name = titleWrap ? (titleWrap.textContent ?? '').trim() : null;
      const images = Array.from(new Set(
        Array.from(card.querySelectorAll('img'))
          .map((img) => img.getAttribute('src'))
          .filter((s): s is string => !!s && s.includes('wp-content/uploads')),
      ));
      items.push({ url, name, images });
    }
    return items;
  });
}

interface DetailRaw {
  h1: string | null;
  cardSpecs: [string, string][];
  specList: [string, string][];
  description: string | null;
  ratesText: string;
}

/** Phase B: pull the rich schema from one yacht detail page. */
async function scrapeDetailPage(page: Page, url: string): Promise<DetailRaw> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return page.evaluate(() => {
    const txt = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

    const h1 = txt(document.querySelector('h1')) || null;

    // Summary spec card: label/value pairs (price/destination/length/cabins/guests)
    const cardSpecs: [string, string][] = Array.from(
      document.querySelectorAll('.yacht-card__spec'),
    ).map((el) => [
      txt(el.querySelector('.yacht-card__spec-label')),
      txt(el.querySelector('.yacht-card__spec-value')),
    ]);

    // Full specifications list (length/beam/draft/speed/built/cabins/watersport/crew)
    const specList: [string, string][] = Array.from(
      document.querySelectorAll('.section-specifications__list-row'),
    )
      .map((row): [string, string] => {
        const parts = (row as HTMLElement).innerText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        return [parts[0] ?? '', parts.slice(1).join(' ')];
      })
      .filter(([l]) => l);

    // "About"/"Overview" description: the first paragraph of the top banner section.
    // Fallback: the longest content paragraph that isn't price/legal boilerplate.
    const bannerP = txt(document.querySelector('section.section-banner p'));
    const description =
      bannerP ||
      Array.from(document.querySelectorAll('p'))
        .map((p) => (p.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter(
          (t) => t.length > 90 && !/€|cookie|privacy|consent|vendor|expenses|a\.p\.a/i.test(t),
        )
        .sort((a, b) => b.length - a.length)[0] ||
      null;

    // Rates section text — parsed in Node.
    const ratesText = (document.body as HTMLElement).innerText;

    return { h1, cardSpecs, specList, description, ratesText };
  });
}

function pairsToMap(pairs: [string, string][]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [label, value] of pairs) {
    const key = label.toLowerCase().replace(/\.$/, '').trim();
    if (key && value) m[key] = value;
  }
  return m;
}

function parseSeasonalRates(bodyText: string): SeasonalRate[] {
  const rates: SeasonalRate[] = [];
  const re = /SEASON\s+([A-Z0-9]+)\s+(FROM[\s\S]*?)(\d[\d.,]*)\s*€/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyText)) !== null) {
    rates.push({
      label: `Season ${m[1].toUpperCase()}`,
      dateRange: m[2].replace(/\s+/g, ' ').trim(),
      priceEur: parsePrice(m[3]),
    });
    if (rates.length > 12) break; // safety
  }
  return rates;
}

function assembleYacht(item: ListingItem, raw: DetailRaw): Yacht {
  const card = pairsToMap(raw.cardSpecs);
  const spec = pairsToMap(raw.specList);

  const price = parsePriceRange(card['price per week']);
  const built = parseBuilt(spec['built / renovated'] ?? spec['built'] ?? null);
  const crew = parseCrew(spec['crew description'] ?? null);

  return {
    id: slugFromUrl(item.url),
    name: clean(raw.h1) ?? clean(item.name) ?? slugFromUrl(item.url),
    url: item.url,
    destination: clean(card['destination'])?.toUpperCase() ?? null,
    priceFromEur: price.from,
    priceToEur: price.to,
    lengthM: parseDimension(spec['length'] ?? card['length']),
    beamM: parseDimension(spec['beam']),
    draftM: parseDimension(spec['draft']),
    cruiseSpeedKn: parseFirstInt(spec['cruise speed']),
    builtYear: built.built,
    renovatedYear: built.renovated,
    cabins: parseFirstInt(spec['cabins for guests'] ?? card['no of cabins'] ?? card['no. of cabins']),
    maxGuests: parseFirstInt(card['no of guests'] ?? card['no. of guests']),
    crewCount: crew.count,
    crewRaw: crew.raw,
    waterSports: parseWaterSports(spec['water sport'] ?? spec['water sports']),
    description: clean(raw.description),
    seasonalRates: parseSeasonalRates(raw.ratesText),
    images: item.images.slice(0, 12),
    scrapedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log(`Scraping listing pages ${START_PAGE}..${START_PAGE + NUM_PAGES - 1}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'en-US' });
  // tsx/esbuild compiles `page.evaluate` callbacks with keepNames, injecting
  // `__name(...)` calls that don't exist in the browser. Define a global no-op so
  // the serialized function bodies resolve it. Passed as a STRING so esbuild leaves
  // it untouched.
  await context.addInitScript('globalThis.__name = globalThis.__name || function (f) { return f; };');
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const yachts: Yacht[] = [];
  const failures: { url: string; error: string }[] = [];

  try {
    // Phase A — collect listing items across pages.
    const items: ListingItem[] = [];
    const seen = new Set<string>();
    for (let p = START_PAGE; p < START_PAGE + NUM_PAGES; p++) {
      const url = listingUrl(p);
      try {
        const pageItems = await scrapeListingPage(page, url);
        for (const it of pageItems) {
          if (!seen.has(it.url)) {
            seen.add(it.url);
            items.push(it);
          }
        }
        console.log(`  listing p${p}: ${pageItems.length} cards (${items.length} unique total)`);
      } catch (e) {
        console.warn(`  listing p${p} FAILED: ${(e as Error).message}`);
      }
      await sleep(jitter());
    }

    // Phase B — visit each detail page.
    const detailItems = LIMIT > 0 ? items.slice(0, LIMIT) : items;
    console.log(`Visiting ${detailItems.length} detail pages...`);
    for (let i = 0; i < detailItems.length; i++) {
      const item = detailItems[i];
      try {
        const raw = await scrapeDetailPage(page, item.url);
        const yacht = assembleYacht(item, raw);
        yachts.push(yacht);
        console.log(
          `  [${i + 1}/${detailItems.length}] ${yacht.name} — €${yacht.priceFromEur ?? '?'}/wk, ` +
            `${yacht.lengthM ?? '?'}m, ${yacht.maxGuests ?? '?'} guests, ${yacht.images.length} imgs`,
        );
      } catch (e) {
        failures.push({ url: item.url, error: (e as Error).message });
        console.warn(
          `  [${i + 1}/${detailItems.length}] FAILED ${item.url}: ${(e as Error).message}`,
        );
      }
      await sleep(jitter());
    }
  } finally {
    await browser.close();
  }

  await mkdir(DATA_DIR, { recursive: true });
  const out = resolve(DATA_DIR, 'yachts.json');
  await writeFile(out, JSON.stringify(yachts, null, 2), 'utf-8');
  console.log(`\nDone. Scraped ${yachts.length}, failed ${failures.length}. Wrote ${out}`);
  if (failures.length) console.log('Failures:', failures);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
