/**
 * Single source of truth for the embedding model + pooling options.
 * BOTH the offline script (scripts/embed.ts) and the runtime embedder
 * (embedder.ts) import this, so yacht vectors and query vectors always
 * live in the same space. Changing the model here means re-running `npm run embed`.
 */
export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM = 384;
export const POOLING_OPTS = { pooling: 'mean', normalize: true } as const;
