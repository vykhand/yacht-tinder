# Build Plan (archived)

> This is the implementation plan that was approved (in Claude Code **plan mode**) before any
> code was written, archived verbatim. The app was then built against it. A short
> **[As-built deltas](#as-built-deltas)** section at the end records where reality diverged.

---

# yacht-tinder — Smart Yacht Charter Discovery App

## Context

The goal is to turn the public yacht-charter catalog at **goolets.net** into a smart discovery app called **yacht-tinder**. The directory `/Users/vykhand/DEV/yacht-tinder` is currently empty — this is a greenfield build.

I inspected the live site to ground the plan. Listing pages (`/yacht-rentals/page/N/?sort=price_desc`) are **server-rendered** and expose `.yacht-card-archive` cards (name, detail URL, length, max guests, "from €X/week", image gallery). Each yacht's **detail page** carries a rich schema: price range, destination, length/beam/draft, cruise speed, built/renovated year, cabins, guests, water sports/toys, crew, an "About" description, and seasonal pricing (Season A/B/C with date ranges). goolets already ships its own "Yacht Matchmaker" + "Compare" — we're building our own, better, swipe-first version.

**Decisions (confirmed with the user):**
- **Core UX:** Tinder-style swipe deck (right = like → wishlist, left = skip; learns taste from swipes) **+** a natural-language semantic search box.
- **Stack:** Next.js 15 full-stack (TypeScript, App Router) — one codebase for scraper, data, API, and UI.
- **Intelligence:** **local vector embeddings** via Transformers.js (`all-MiniLM-L6-v2`, 384-dim) — no API keys, no cost. Powers both semantic search and swipe-taste learning.
- **Data scope:** **sample first** — scrape ~20–40 yachts (first 1–2 listing pages + their detail pages), manual re-run; designed to scale to the full catalog later.

**Outcome:** a local Next.js app where you can swipe through yachts (the deck reorders toward your taste) and search the fleet in plain English ("Greece, 8 guests, jet skis, under €50k/week").

---

## Architecture & File Structure

```
yacht-tinder/
├── package.json                    # scripts: scrape, embed, dev, build
├── next.config.mjs                 # serverExternalPackages + images.remotePatterns  ← make-or-break
├── tsconfig.json
├── .gitignore                      # node_modules, .next, .models (HF cache)
├── scripts/
│   ├── scrape.ts                   # Playwright scraper → data/yachts.json
│   ├── embed.ts                    # Transformers.js → data/embeddings.json (OFFLINE)
│   └── lib/parse.ts                # pure field parsers (price→int, length→float, …)
├── data/
│   ├── yachts.json                 # scraped Yacht[] (committed)
│   └── embeddings.json             # { id, vector[384] }[] (committed)
└── src/
    ├── types/yacht.ts              # Yacht, SeasonalRate, EmbeddingRecord, HardFilters
    ├── lib/
    │   ├── embeddings/
    │   │   ├── embedder.ts         # server-only singleton pipeline (mean-pool + normalize)
    │   │   └── compose.ts          # yacht → embedding text (SHARED w/ scripts/embed.ts)
    │   ├── search/
    │   │   ├── vector.ts           # cosineSimilarity (dot on normalized), meanVector, normalize
    │   │   ├── parseQuery.ts       # regex/heuristic → HardFilters (no LLM)
    │   │   ├── filter.ts           # apply hard constraints
    │   │   ├── semantic.ts         # embed query → filter → cosine rank (public search API)
    │   │   └── taste.ts            # preference vector → swipe ranking (pure math)
    │   └── data/store.ts           # lazy-load + cache yachts.json/embeddings.json (Maps)
    ├── app/
    │   ├── layout.tsx · globals.css · page.tsx (home)
    │   ├── swipe/page.tsx · search/page.tsx · wishlist/page.tsx
    │   └── api/
    │       ├── search/route.ts     # POST query → ranked yachts   (runtime = 'nodejs')
    │       ├── recommend/route.ts  # POST liked/disliked ids → deck (pure math)
    │       └── yachts/route.ts     # GET list / by-id (hydrate wishlist + seed deck)
    ├── store/usePreferences.ts     # Zustand + persist: likedIds, skippedIds, wishlist
    └── components/
        ├── SwipeDeck.tsx (framer-motion drag) · YachtCard.tsx · ImageGallery.tsx
        ├── SpecBadges.tsx · SearchBar.tsx · SearchResults.tsx · WishlistView.tsx
```

`scripts/` runs via **tsx**, never imported by the Next build — keeps Playwright out of the app bundle. `parse.ts` and `compose.ts` are **pure, dependency-free** so both scripts and app can import them. `data/*.json` are committed artifacts: the contract between the offline pipeline and runtime.

**Library pins:** `next@15` (stable `serverExternalPackages`), `@huggingface/transformers@^3` (the maintained successor to `@xenova/transformers`; pin exact minor), `playwright@1.60` (+ `npx playwright install chromium`), `zustand@^5`, `framer-motion@^11/12`, `tsx`, `typescript@^5`.

---

## Implementation Steps

### 1. Scaffold
`npm init`, install deps, `tsconfig.json`, `next.config.mjs`, npm scripts (`scrape`, `embed`, `dev`, `build`). **`next.config.mjs` must include:**
```js
serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'sharp'],
images: { remotePatterns: [{ protocol: 'https', hostname: 'goolets.net' }] },
```

### 2. Scraper (`scripts/scrape.ts`) — `npm run scrape`
- Headless Chromium; `browser.newContext` with realistic `userAgent`/`locale`.
- Loop listing pages `1..N` (config/argv, default 2). **`waitUntil: 'domcontentloaded'` — NOT `networkidle`** (Swiper galleries keep the network busy and would hang).
- Extract `.yacht-card-archive` → name, absolute detail URL, listing length/guests/price, gallery imgs.
- Dedupe detail URLs; visit each **sequentially** with jittered delay (1500–3500 ms, `SCRAPE_DELAY_MS`). Parse rich schema from `.section-specifications__list` / `.yacht-card__specs`, About text, water toys, crew, Season A/B/C table.
- Per-yacht `try/catch` → failures logged, loop continues. Key by **slug** (`tatiana-i`) for idempotent future re-runs. Single atomic write of `data/yachts.json` at end. Print `scraped X / failed Y`.
- **Number-format traps (separate pure parsers, do NOT share a "strip dots" routine):** price uses `.` as **thousands** (`€160.000` → `160000`); length/beam use `.` as **decimal** (`8.9 m` → `8.9`). Every numeric field is **nullable** (`number | null`) — real WP pages have gaps.
- `Yacht` interface (`src/types/yacht.ts`): `id, name, url, destination, priceFromEur, priceToEur, lengthM, beamM, draftM, cruiseSpeedKn, builtYear, renovatedYear, cabins, maxGuests, crewCount, crewRaw, waterSports[], description, seasonalRates[{label,dateRange,priceEur}], images[], scrapedAt`.

### 3. Offline embeddings (`scripts/embed.ts`) — `npm run embed`
- Read `yachts.json`; for each yacht build text via shared `compose.ts` (name + destination + description + water sports + key specs; skip nulls cleanly so we never embed the literal `"null"`).
- Run `feature-extraction` pipeline with **`{ pooling: 'mean', normalize: true }`** → 384-vector → `number[]`. Write `data/embeddings.json` keyed by id.
- **The same compose+embed+pooling+normalize code path must produce both yacht vectors (here) and the runtime query vector** — otherwise the vector spaces don't match and ranking silently breaks.

### 4. Search + recommendation (`src/lib/search/`)
- `vector.ts`: cosine = dot product (vectors are normalized); `meanVector`, `normalize`, `subtract`.
- `parseQuery.ts`: heuristic `HardFilters` — `maxPriceEur`/`minPriceEur` (`/under|below|<|max\s*€?([\d.,]+)\s*k?/`, ×1000 for `k`), `minGuests` (`/(\d+)\s*(guests|people|pax)/`), `destination` (match against destinations **present in the data**), `waterSports` (match against the toy vocabulary in the data). Keep the full sentence for embedding.
- `filter.ts`: drop yachts failing hard constraints; policy — when a constraint is set and the field is `null`, **exclude** (don't show what we can't verify).
- `semantic.ts` (public): `parseQuery → applyFilters → embed query → cosine rank → top-K`, returning `{ yacht, score, matched[] }` for "why it matched" chips.
- `taste.ts`: `pref = normalize(mean(likedVecs) − mean(dislikedVecs))`; rank unswiped yachts by `cosine(pref, vec)`. Edge cases: no likes → default order (not empty); only dislikes → move away from their mean; guard empty arrays against NaN. Pure math, no model load.

### 5. API routes (App Router, all `export const runtime = 'nodejs'`)
- `POST /api/search` → `{ query, limit? }` ⇒ `{ filters, results[] }`.
- `POST /api/recommend` → `{ likedIds, dislikedIds, excludeIds?, limit? }` ⇒ `{ deck[] }` (fast, no model).
- `GET /api/yachts` → list / `?id=` for wishlist hydration + initial deck seed.
- `src/lib/data/store.ts` reads both JSON files once, caches `Map<id,Yacht>` + `Map<id,Float32Array>` in module scope.

### 6. State + UI
- **Zustand + `persist`** (`usePreferences.ts`): `likedIds`, `skippedIds`, `wishlist`. Persist ids only; the preference vector is derived server-side per `/api/recommend` call. **Guard SSR hydration** (render deck after `useEffect` mount / `skipHydration`) to avoid localStorage mismatch.
- **SwipeDeck** with **framer-motion** `drag="x"` + `onDragEnd` (velocity/offset → like vs skip), rotation + like/nope overlay via `useTransform`, `AnimatePresence` exit fling. (Chosen over `react-tinder-card`, which fights React 19 / App Router.) Render top 2–3 cards; on swipe call `store.like/skip`, pop, and refetch `/api/recommend` when the local deck runs low.
- **YachtCard** = `ImageGallery` (`next/image`, remote host whitelisted; AVIF hotlinked — fine for v1) + `SpecBadges` + truncated About. **SearchBar/SearchResults** show parsed filters back to the user ("Greece · ≥8 guests · ≤€50k") for transparency. **WishlistView** reads ids → `/api/yachts` → cards with remove.

---

## Verification (end-to-end)

1. `npm run scrape` → `data/yachts.json` is `Yacht[]`, length 20–40; spot-check **Tatiana I** has non-null name/price/length/guests/images + `seasonalRates`; prices are clean EUR ints (no `.` artifacts), lengths are floats.
2. `npm run embed` → `data/embeddings.json` has one record per yacht, each `vector.length === 384`, **L2 norm ≈ 1** (proves normalization). Sanity: cosine(yacht, itself) ≈ 1, and "Greece 8 guests jet ski" ranks a matching yacht above an unrelated one (catches pooling/normalize bugs early).
3. `npm run dev` → curl `POST /api/search` `"Greece, 8 guests, jet skis, under €50k/week"` → confirm `filters` = {destination: GREECE, minGuests: 8, maxPriceEur: 50000, waterSports:[jet ski]} and results filtered + ranked. `POST /api/recommend` with a couple `likedIds` → ordering shifts toward similar yachts.
4. **Playwright MCP browser** (available): open `/swipe`, drag-swipe a few cards → wishlist grows, deck reorders; `/search` NL query → results + filter chips; reload `/wishlist` → persists (localStorage). Screenshot each screen.
5. Cold-start: first `/api/search` loads the model once (slow), subsequent calls fast (singleton works); `.next` contains no bundled `.node` binaries (externalization worked).

---

## Top 3 Risks (and mitigations)

1. **Transformers.js × Next bundling** — `onnxruntime-node`/`sharp` in `serverExternalPackages`; embedder is `import 'server-only'` + Node runtime; HF model cached to gitignored `.models/`; **module-level singleton pipeline** so the 90 MB model loads once, not per request.
2. **Embedding-space drift** — yacht vectors (offline) and query vectors (runtime) MUST use the same model + `{pooling:'mean', normalize:true}` + pinned package version. Enforced by sharing `compose.ts` + the embed call and pinning `@huggingface/transformers`.
3. **Scraper brittleness** — selectors/number-formats on a live WordPress site: use `domcontentloaded`, per-field pure parsers (unit-testable), per-yacht try/catch + failure log, nullable schema, jittered delays, key-by-slug for idempotent re-runs. Hotlinked AVIF images may break later → optional future step downloads images into `public/`.

---

## As-built deltas

Where the shipped code differs from the plan above (and why):

| Area | Plan | As built | Why |
|------|------|----------|-----|
| Framework | Next 15, `@huggingface/transformers@^3` | **Next 16, transformers v4**, framer-motion 12 | `npm install` pulled current majors; the make-or-break configs (`serverExternalPackages`, `{pooling:'mean',normalize:true}`) are stable across both. |
| Routes | `/swipe`, `/search`, `/wishlist` | **`/` (Discover), `/search`, `/saved`** + a `BottomNav` tab bar | Cleaner mobile-app navigation; swipe is the home screen. |
| Images | `next/image` (remote host whitelisted) | **plain `<img>`** (lazy) | Avoids the image optimizer choking on hotlinked AVIF; bulletproof for the demo. |
| Components | `SearchBar` + `SearchResults` separate | consolidated into **`SearchView`** | Plus added `icons.tsx`, `format.ts`, `BottomNav.tsx`. |
| Wishlist | separate `wishlist` array | **`wishlist === likedIds`** | Simpler; a `hydrated` flag guards the SSR/localStorage mismatch. |
| tsconfig | — | added **`allowImportingTsExtensions`** | `scripts/*.ts` import sibling `.ts` files with explicit extensions (needed by tsx). |
| next.config | — | added **`turbopack.root`** | A stray lockfile in the home dir confused Turbopack's root inference. |

**Scraper fixes made during the build** (see code comments):
- **esbuild `__name` ReferenceError** inside `page.evaluate` (tsx compiles callbacks with `keepNames`) → fixed by injecting a global `__name` no-op via `context.addInitScript('…')` as a **string** (so esbuild doesn't transform it).
- A **`/yacht-matchmaker/` promo card** with a relative URL leaked into the listing scrape → fixed with a strict `^/yacht-rentals/<slug>/$` URL filter + absolute hrefs.
- The **"About" description** first grabbed the expenses/APA boilerplate → retargeted to the first `<p>` of the top `section.section-banner` (the Overview paragraph), with the longest-clean-paragraph heuristic as fallback.
- Added a `--limit=N` flag for fast iteration during development.
