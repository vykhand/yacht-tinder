/**
 * Apply HardFilters to a yacht list. Policy: when a constraint is specified but
 * the yacht's field is null/empty, EXCLUDE it — we don't show a yacht we can't
 * verify meets the constraint. Returns survivors plus the human-readable labels
 * of which constraints each one matched (for "why it matched" chips).
 */
import type { Yacht, HardFilters } from '@/types/yacht';

export interface FilteredYacht {
  yacht: Yacht;
  matched: string[];
}

function eur(n: number): string {
  return n >= 1000 ? `€${Math.round(n / 1000)}k` : `€${n}`;
}

/** Does a yacht offer a toy matching the requested keyword? */
function hasToy(yacht: Yacht, toy: string): boolean {
  return yacht.waterSports.some((w) => w.toLowerCase().includes(toy));
}

export function applyFilters(yachts: Yacht[], f: HardFilters): FilteredYacht[] {
  const out: FilteredYacht[] = [];

  for (const yacht of yachts) {
    const matched: string[] = [];

    if (f.maxPriceEur != null) {
      if (yacht.priceFromEur == null || yacht.priceFromEur > f.maxPriceEur) continue;
      matched.push(`≤ ${eur(f.maxPriceEur)}/wk`);
    }
    if (f.minPriceEur != null) {
      if (yacht.priceFromEur == null || yacht.priceFromEur < f.minPriceEur) continue;
      matched.push(`≥ ${eur(f.minPriceEur)}/wk`);
    }
    if (f.minGuests != null) {
      if (yacht.maxGuests == null || yacht.maxGuests < f.minGuests) continue;
      matched.push(`≥ ${f.minGuests} guests`);
    }
    if (f.destination != null) {
      if (yacht.destination == null || yacht.destination.toLowerCase() !== f.destination.toLowerCase())
        continue;
      matched.push(titleCase(f.destination));
    }
    if (f.waterSports?.length) {
      const missing = f.waterSports.some((toy) => !hasToy(yacht, toy));
      if (missing) continue;
      matched.push(...f.waterSports);
    }

    out.push({ yacht, matched });
  }

  return out;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
