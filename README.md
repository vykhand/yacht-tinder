# ⚓ yacht·tinder

A smart yacht-charter discovery app built on data scraped from [goolets.net](https://goolets.net).
**Swipe** through luxury yachts Tinder-style (the deck learns your taste), or **search** the
fleet in plain English — _"Greece, 8 guests, jet skis, under €150k"_.

Everything runs locally: a Playwright scraper, **local vector embeddings** (Transformers.js,
`all-MiniLM-L6-v2` — no API keys), and a Next.js app.

---

## Quick start

```bash
npm install
npx playwright install chromium    # one-time, for the scraper

npm run scrape    # scrape ~34 yachts → data/yachts.json
npm run embed     # compute 384-dim embeddings → data/embeddings.json
npm run dev       # http://localhost:3000
```

`data/yachts.json` and `data/embeddings.json` are committed, so `npm run dev` works without
re-scraping. Re-run `scrape` + `embed` (then restart dev) to refresh the data.

### Start & stop the app

```bash
npm run dev      # development, hot-reload  → http://localhost:3000
# or
npm run build && npm run start   # optimized production build → http://localhost:3000
```

**To stop it:** press **Ctrl + C** in the terminal where it's running.

If it's running in the background, in another window, or the port is stuck, run:

```bash
npm run stop          # frees port 3000 — works on Windows, macOS and Linux
npm run stop 4000     # …or pass a different port
```

`npm run stop` is a tiny zero-dependency Node script (`scripts/stop.mjs`) that finds and kills
whatever is listening on the port, cross-platform.

## How it works

```
scrape ─► data/yachts.json ─► embed ─► data/embeddings.json
                                              │
                          ┌───────────────────┴───────────────────┐
                   POST /api/search                        POST /api/recommend
              parseQuery → filter →                  preference vector from likes
              embed query → cosine rank              − dislikes → cosine rank
                          (semantic search)                 (swipe taste)
```

- **Scraper** (`scripts/scrape.ts`) — Playwright walks the listing pages, then each yacht's
  detail page, parsing name, destination, price, dimensions, cabins/guests, crew, water toys,
  description, seasonal rates and photos. Polite (sequential + jittered delays), idempotent
  (keyed by slug), and resilient (per-yacht try/catch).
- **Embeddings** (`scripts/embed.ts`) — composes each yacht into a sentence and embeds it
  **offline** with mean-pooling + L2-normalization. The runtime only ever embeds the short
  search query, using the **same** model/options (`src/lib/embeddings/config.ts`) so the
  vectors share one space.
- **Search** (`src/lib/search/`) — a no-LLM heuristic parser extracts hard filters
  (destination, min guests, price caps, water toys) from the query; survivors are ranked by
  cosine similarity to the embedded query.
- **Taste** (`src/lib/search/taste.ts`) — `pref = normalize(mean(liked) − mean(disliked))`;
  the swipe deck re-ranks toward `pref` as you swipe. Pure vector math, no model load.
- **UI** — Next.js App Router + framer-motion swipe gestures + Zustand (localStorage) for the
  shortlist. Three tabs: **Discover** (swipe), **Search**, **Saved**.

## Project layout

| Path | What |
|------|------|
| `scripts/scrape.ts` | Playwright scraper → `data/yachts.json` |
| `scripts/embed.ts` | Offline embeddings → `data/embeddings.json` |
| `src/types/yacht.ts` | `Yacht`, `SeasonalRate`, `HardFilters`, … |
| `src/lib/embeddings/` | `config.ts` (shared), `embedder.ts` (server-only singleton), `compose.ts` |
| `src/lib/search/` | `parseQuery`, `filter`, `semantic`, `taste`, `vector` |
| `src/lib/data/store.ts` | cached loader for the two JSON artifacts |
| `src/app/api/*` | `search`, `recommend`, `yachts` route handlers (Node runtime) |
| `src/components/` | `SwipeDeck`, `YachtCard`, `SearchView`, `WishlistView`, … |

## Scope & next steps

This is a **sample-first** prototype (first 2 listing pages, ~34 yachts). To scale:

- `npm run scrape -- --pages=N` to grab more of the catalog, then re-`embed`.
- For thousands of yachts, swap the in-memory cosine scan + JSON store for a vector DB and a
  binary embedding format.
- Optionally download/cache yacht images locally (`public/`) instead of hotlinking, and add a
  scheduled refresh.

## How this app was built

This whole app was built **live in one session with [Claude Code](https://claude.com/claude-code)**,
agentically, in **plan mode** — Claude inspected the live site, proposed a design, got it approved,
then scaffolded, scraped, embedded, coded, and verified everything end-to-end (driving its own
browser via the Playwright MCP). The approved design is archived in
[`BUILD_PLAN.md`](./BUILD_PLAN.md).

### The prompts (what the human typed)

1. **Kick-off** — *"I want to scrape this site with playwright: `…/yacht-rentals/page/2/?sort=price_desc`
   and I want to make smart yacht search application out of it."*
2. **Five planning decisions** (answered as multiple-choice in plan mode):
   - Core experience → **Swipe deck + AI search**
   - Stack → **Next.js full-stack**
   - "Smart" mechanism → **Embeddings / semantic**
   - Data scope → **Sample first (~34 yachts)**
   - Embeddings provider → **Local (Transformers.js, no API keys)**
3. **Approved the plan** → Claude built it autonomously (scaffold → scrape → embed → search/API →
   UI → verify), tracking progress as a live task list.
4. *"Stop the app; add start/stop instructions to the README; add the workshop credit."*
5. *"Archive the plan into `BUILD_PLAN.md`; document the build process in the README."*

### Additional interventions (what Claude did beyond the prompts)

The human only steered with the decisions above — Claude handled the engineering, including several
mid-build course-corrections it discovered and fixed on its own:

- **Grounded the plan in reality** — opened goolets.net with a real browser first and mapped the
  actual DOM/data schema before designing anything.
- **Scraper debugging** — fixed an esbuild `__name` error inside Playwright's `page.evaluate`,
  filtered out a non-yacht promo card, and retargeted the "About" text to the right paragraph (it
  first grabbed payment boilerplate). See [`BUILD_PLAN.md`](./BUILD_PLAN.md#as-built-deltas).
- **Adapted to newer libraries** than the plan assumed (Next 16 / Transformers v4 vs the planned
  15 / v3) without breaking the integration.
- **Self-verified** — ran an offline semantic-ranking sanity check, tested the APIs with `curl`,
  drove the swipe/search/saved flows in the browser and screenshotted them, and confirmed a clean
  production `npm run build` (no native-addon bundling errors).

> The takeaway from the workshop: a single well-scoped prompt plus a handful of multiple-choice
> decisions was enough to take this from an empty folder to a working, verified app.

## Credits

Developed with [Claude Code](https://claude.com/claude-code) during the **AI Workflow Automation
workshop** at **Kodo coworking space**, Ljubljana — **4 June 2026**.

> Built as a demo. Yacht data and images belong to goolets.net.
