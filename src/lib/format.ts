/** Pure, client-safe formatting helpers. */
import type { Yacht } from '@/types/yacht';

/** 160000 -> "€160k", 95000 -> "€95k", 800 -> "€800". */
export function priceShort(eur: number | null): string {
  if (eur == null) return '—';
  if (eur >= 1000) return `€${Math.round(eur / 1000)}k`;
  return `€${eur}`;
}

export function titleCase(s: string | null): string {
  if (!s) return '';
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface SpecItem {
  value: string;
  label: string;
}

/** The compact spec set shown on cards. */
export function specItems(y: Yacht): SpecItem[] {
  const out: SpecItem[] = [];
  if (y.lengthM != null) out.push({ value: `${y.lengthM}m`, label: 'length' });
  if (y.maxGuests != null) out.push({ value: `${y.maxGuests}`, label: 'guests' });
  if (y.cabins != null) out.push({ value: `${y.cabins}`, label: 'cabins' });
  if (y.crewCount != null) out.push({ value: `${y.crewCount}`, label: 'crew' });
  if (y.builtYear != null) out.push({ value: `${y.renovatedYear ?? y.builtYear}`, label: 'built' });
  return out;
}
