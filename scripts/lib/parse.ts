/**
 * Pure, dependency-free field parsers for goolets.net yacht data.
 *
 * CRITICAL number-format gotcha on this site:
 *   - PRICES use "." as a THOUSANDS separator:  "€160.000"  -> 160000
 *   - DIMENSIONS use "." as a DECIMAL point:    "8.9 meters" -> 8.9
 * So prices and dimensions get SEPARATE parsers. Never share a "strip dots"
 * routine between them.
 *
 * Every parser tolerates missing/odd input and returns null rather than NaN.
 */

/** Strip thousands separators ("." and spaces) and parse a EUR integer. */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/[\d][\d.,\s]*\d|\d/);
  if (!m) return null;
  const digits = m[0].replace(/[.,\s]/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse a "FROM x TO y" / "from x / week" price range. */
export function parsePriceRange(
  text: string | null | undefined,
): { from: number | null; to: number | null } {
  if (!text) return { from: null, to: null };
  const matches = text.match(/[\d][\d.,\s]*\d|\d/g) ?? [];
  const nums = matches
    .map((s) => parseInt(s.replace(/[.,\s]/g, ''), 10))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return { from: null, to: null };
  if (nums.length === 1) return { from: nums[0], to: null };
  return { from: nums[0], to: nums[1] };
}

/** Parse a dimension where "." is a decimal point: "45 meters", "8.9 m". */
export function parseDimension(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Extract the first integer found: "up to 12 guests" -> 12, "14 knot" -> 14. */
export function parseFirstInt(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse "2011 / 2022" -> { built, renovated }. Single year -> renovated null. */
export function parseBuilt(text: string | null | undefined): {
  built: number | null;
  renovated: number | null;
} {
  if (!text) return { built: null, renovated: null };
  const years = (text.match(/\b(19|20)\d{2}\b/g) ?? []).map((y) => parseInt(y, 10));
  return { built: years[0] ?? null, renovated: years[1] ?? null };
}

/** Split a comma-separated water-toys string into a clean list. */
export function parseWaterSports(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/[,/]|·|•/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 60);
}

/** Parse "9 crew members" -> { count: 9, raw }. */
export function parseCrew(text: string | null | undefined): {
  count: number | null;
  raw: string | null;
} {
  if (!text) return { count: null, raw: null };
  const raw = text.trim();
  return { count: parseFirstInt(raw), raw: raw || null };
}

/** Slug from a detail URL: ".../yacht-rentals/tatiana-i/" -> "tatiana-i". */
export function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const seg = path.split('/').filter(Boolean).pop() ?? '';
    return seg;
  } catch {
    return url.replace(/\/+$/, '').split('/').filter(Boolean).pop() ?? '';
  }
}

/** Resolve a possibly-relative href against a base URL. */
export function toAbsoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** Collapse whitespace and trim. */
export function clean(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
}

/**
 * Turn a flat list of spec lines like
 *   ["LENGTH", "45 meters", "BEAM", "8.9 meters", ...]
 * into a label->value map keyed by lowercased label.
 */
export function pairLabelsToValues(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const label = lines[i]?.trim().toLowerCase();
    const value = lines[i + 1]?.trim();
    if (label && value) out[label] = value;
  }
  return out;
}
