/**
 * Heuristic natural-language → HardFilters extractor. No LLM: just regex +
 * vocabulary matching. We KEEP the full sentence for embedding; these filters
 * only narrow the candidate set and power the "why it matched" chips.
 */
import type { HardFilters } from '@/types/yacht';

/** Canonical water-toy keywords we recognize in queries. */
const TOY_KEYWORDS = [
  'jet ski',
  'seabob',
  'paddleboard',
  'kayak',
  'wakeboard',
  'water ski',
  'waterski',
  'snorkel',
  'scuba',
  'diving',
  'flyboard',
  'e-foil',
  'efoil',
  'tube',
  'trampoline',
  'slide',
  'jacuzzi',
];

/** Parse a money token into EUR. Handles "50k", "50.000", "50,000", "1.5k". */
function parseMoney(numStr: string, hasK: boolean): number | null {
  if (hasK) {
    const n = parseFloat(numStr.replace(/,/g, ''));
    return Number.isFinite(n) ? Math.round(n * 1000) : null;
  }
  const n = parseInt(numStr.replace(/[.,\s]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function parseQuery(query: string, knownDestinations: string[] = []): HardFilters {
  const q = query.toLowerCase();
  const filters: HardFilters = {};

  // Max price: "under €50k", "below 50,000", "less than 30k", "max €40000", "< 50k"
  const maxRe =
    /(?:under|below|less than|cheaper than|max(?:imum)?|up to|<=?|≤)\s*€?\s*([\d][\d.,]*)\s*(k|thousand|grand)?/i;
  const maxM = q.match(maxRe);
  if (maxM) {
    const v = parseMoney(maxM[1], !!maxM[2]);
    if (v != null) filters.maxPriceEur = v;
  }

  // Min price: "over €100k", "above 80,000", "at least 50k", "from €60000", "> 100k"
  const minRe =
    /(?:over|above|more than|at least|minimum|min|starting (?:at|from)|>=?|≥)\s*€?\s*([\d][\d.,]*)\s*(k|thousand|grand)?/i;
  const minM = q.match(minRe);
  if (minM) {
    const v = parseMoney(minM[1], !!minM[2]);
    if (v != null) filters.minPriceEur = v;
  }

  // Min guests: "8 guests", "for 10 people", "12 pax"
  const guestsM = q.match(/(\d+)\s*(?:\+\s*)?(?:guests?|people|persons?|pax|adults?|passengers?)/i);
  if (guestsM) {
    const g = parseInt(guestsM[1], 10);
    if (Number.isFinite(g)) filters.minGuests = g;
  }

  // Destination: match against destinations actually present in the data.
  for (const dest of knownDestinations) {
    if (q.includes(dest.toLowerCase())) {
      filters.destination = dest;
      break;
    }
  }

  // Water toys: collect canonical keywords mentioned in the query.
  const toys = TOY_KEYWORDS.filter((t) => q.includes(t));
  // de-dupe near-synonyms (water ski / waterski, e-foil / efoil)
  const normalizedToys = Array.from(
    new Set(toys.map((t) => t.replace(/^waterski$/, 'water ski').replace(/^efoil$/, 'e-foil'))),
  );
  if (normalizedToys.length) filters.waterSports = normalizedToys;

  return filters;
}
