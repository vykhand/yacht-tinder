/**
 * Public semantic search entry point (SERVER ONLY).
 *   parseQuery → applyFilters → embed query → cosine-rank candidates.
 */
import 'server-only';
import type { HardFilters, RankedYacht } from '@/types/yacht';
import { getStore } from '@/lib/data/store';
import { embedQuery } from '@/lib/embeddings/embedder';
import { parseQuery } from './parseQuery';
import { applyFilters } from './filter';
import { dot } from './vector';

export interface SearchResult {
  filters: HardFilters;
  results: RankedYacht[];
}

export async function search(query: string, limit = 24): Promise<SearchResult> {
  const store = await getStore();
  const filters = parseQuery(query, store.destinations);
  const candidates = applyFilters(store.yachts, filters);

  // Embed the full natural-language query once, in the same space as the yachts.
  const qvec = await embedQuery(query);

  const results: RankedYacht[] = candidates
    .map(({ yacht, matched }) => {
      const v = store.vectors.get(yacht.id);
      // vectors are L2-normalized → dot product == cosine similarity
      const score = v ? dot(qvec, v) : 0;
      return { yacht, score, matched };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { filters, results };
}
