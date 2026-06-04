'use client';

import { useState } from 'react';
import type { RankedYacht, HardFilters } from '@/types/yacht';
import { priceShort, titleCase } from '@/lib/format';
import { SearchIcon } from './icons';

const EXAMPLES = [
  'sailing yacht in Greece with jet skis for 8 guests',
  'big motor yacht in Croatia, under €150k',
  'intimate elegant charter for a couple',
  'family yacht with lots of water toys',
];

function filterChips(f: HardFilters): string[] {
  const out: string[] = [];
  if (f.destination) out.push(titleCase(f.destination));
  if (f.minGuests != null) out.push(`≥ ${f.minGuests} guests`);
  if (f.maxPriceEur != null) out.push(`≤ ${priceShort(f.maxPriceEur)}/wk`);
  if (f.minPriceEur != null) out.push(`≥ ${priceShort(f.minPriceEur)}/wk`);
  if (f.waterSports?.length) out.push(...f.waterSports);
  return out;
}

export default function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RankedYacht[] | null>(null);
  const [filters, setFilters] = useState<HardFilters>({});
  const [loading, setLoading] = useState(false);

  async function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const data = (await res.json()) as { filters: HardFilters; results: RankedYacht[] };
      setFilters(data.filters ?? {});
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const chips = filterChips(filters);

  return (
    <main className="main">
      <div className="search-head">
        <span className="eyebrow">describe your charter</span>
        <h1 className="headline">
          Find her in <em>plain words.</em>
        </h1>
      </div>

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Greece, 8 guests, jet skis, under €150k…"
          aria-label="Search yachts"
        />
        <button type="submit" disabled={loading} aria-label="Search">
          <SearchIcon width={18} height={18} />
        </button>
      </form>

      {/* parsed hard filters, or example prompts before first search */}
      {results === null ? (
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => run(ex)}>
              {ex}
            </button>
          ))}
        </div>
      ) : (
        <div className="filter-line">
          {chips.length > 0 ? (
            <>
              <i>filters ·</i>
              {chips.map((c) => (
                <span key={c} className="chip chip--filter">
                  {c}
                </span>
              ))}
            </>
          ) : (
            <i>semantic match · no hard filters</i>
          )}
        </div>
      )}

      {loading && (
        <div className="center-col" style={{ minHeight: 160 }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && results !== null && results.length === 0 && (
        <div className="empty">
          <h2 className="headline">No yacht fits all of that.</h2>
          <p>Try loosening a constraint — a higher budget, fewer guests, or a different sea.</p>
        </div>
      )}

      {!loading && results !== null && results.length > 0 && (
        <div className="results">
          {results.map((r, idx) => (
            <a
              key={r.yacht.id}
              className="row"
              href={r.yacht.url}
              target="_blank"
              rel="noreferrer"
            >
              <div className="row__thumb">
                {r.yacht.images[0] && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={r.yacht.images[0]} alt={r.yacht.name} loading="lazy" />
                )}
                <span className="row__rank">#{idx + 1}</span>
              </div>
              <div className="row__body">
                {r.yacht.destination && (
                  <span className="row__loc">{titleCase(r.yacht.destination)}</span>
                )}
                <span className="row__name">{r.yacht.name}</span>
                <span className="row__meta">
                  <b>{priceShort(r.yacht.priceFromEur)}</b>/wk · {r.yacht.lengthM}m ·{' '}
                  {r.yacht.maxGuests} guests
                </span>
                {r.matched.length > 0 && (
                  <div className="row__matched">
                    {r.matched.map((m) => (
                      <span key={m} className="tag">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
