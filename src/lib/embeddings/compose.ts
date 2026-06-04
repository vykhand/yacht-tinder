/**
 * Compose the natural-language text that represents a yacht for embedding.
 * Pure + dependency-free so both the offline embed script and (potentially)
 * the app can call it. Nulls are skipped cleanly — we never embed "null".
 *
 * Uses a RELATIVE type import so it resolves identically under tsx (scripts)
 * and the Next bundler.
 */
import type { Yacht } from '../../types/yacht.ts';

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function composeYachtText(y: Yacht): string {
  const parts: string[] = [];
  parts.push(`${y.name}.`);
  if (y.destination) parts.push(`Cruising destination: ${titleCase(y.destination)}.`);
  if (y.description) parts.push(y.description);
  if (y.waterSports.length) {
    parts.push(`Water sports and toys onboard: ${y.waterSports.join(', ')}.`);
  }

  const specs: string[] = [];
  if (y.lengthM != null) specs.push(`${y.lengthM} meters long`);
  if (y.maxGuests != null) specs.push(`accommodates up to ${y.maxGuests} guests`);
  if (y.cabins != null) specs.push(`${y.cabins} cabins`);
  if (y.crewCount != null) specs.push(`${y.crewCount} crew`);
  if (y.builtYear != null) specs.push(`built in ${y.builtYear}`);
  if (specs.length) parts.push(`This yacht is ${specs.join(', ')}.`);

  if (y.priceFromEur != null) {
    parts.push(`Weekly charter price from €${y.priceFromEur.toLocaleString('en-US')}.`);
  }

  return parts.join(' ');
}
