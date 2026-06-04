/**
 * Swipe-taste recommendation (SERVER ONLY).
 *
 * Build a preference vector from the user's likes/dislikes and rank the
 * remaining yachts by similarity to it. Pure vector math — no model load, so
 * this is fast.
 *
 *   pref = normalize( mean(likedVecs) - mean(dislikedVecs) )
 *
 * Edge cases:
 *   - no signal at all → return the deck in a sensible default order (price desc,
 *     matching the site's default) so the swipe deck is never empty.
 *   - only dislikes → move AWAY from their mean.
 */
import 'server-only';
import type { RankedYacht } from '@/types/yacht';
import { getStore } from '@/lib/data/store';
import { meanVector, subtract, normalize, scale, dot } from './vector';

export async function recommend(
  likedIds: string[],
  dislikedIds: string[],
  excludeIds: string[] = [],
  limit = 30,
): Promise<RankedYacht[]> {
  const store = await getStore();

  const likedVecs = likedIds
    .map((id) => store.vectors.get(id))
    .filter((v): v is number[] => !!v);
  const dislikedVecs = dislikedIds
    .map((id) => store.vectors.get(id))
    .filter((v): v is number[] => !!v);

  const exclude = new Set([...likedIds, ...dislikedIds, ...excludeIds]);
  const pool = store.yachts.filter((y) => !exclude.has(y.id));

  let pref: number[] | null = null;
  if (likedVecs.length && dislikedVecs.length) {
    pref = normalize(subtract(meanVector(likedVecs), meanVector(dislikedVecs)));
  } else if (likedVecs.length) {
    pref = normalize(meanVector(likedVecs));
  } else if (dislikedVecs.length) {
    pref = normalize(scale(meanVector(dislikedVecs), -1));
  }

  const ranked: RankedYacht[] = pool.map((yacht) => {
    const v = store.vectors.get(yacht.id);
    const score = pref && v ? dot(pref, v) : 0;
    return { yacht, score, matched: [] };
  });

  if (pref) {
    ranked.sort((a, b) => b.score - a.score);
  } else {
    // Cold start: most expensive first (the site's default sort), deterministic.
    ranked.sort((a, b) => (b.yacht.priceFromEur ?? 0) - (a.yacht.priceFromEur ?? 0));
  }

  return ranked.slice(0, limit);
}
