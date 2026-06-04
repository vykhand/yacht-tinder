/**
 * Runtime query embedder — SERVER ONLY.
 *
 * `import 'server-only'` guarantees this never gets bundled into a Client
 * Component (the model + ONNX runtime are tens of MB). A module-level singleton
 * pipeline means the model loads once per server process, not per request.
 *
 * NOTE: the offline script (scripts/embed.ts) deliberately does NOT import this
 * file (server-only would throw under tsx). It re-implements the same tiny load
 * using the shared ./config, so both code paths stay in the same vector space.
 */
import 'server-only';
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { EMBED_MODEL, POOLING_OPTS } from './config';

// Cache the model weights in a gitignored dir at the project root.
env.cacheDir = '.models';

let pipePromise: Promise<FeatureExtractionPipeline> | null = null;

function getPipeline(): Promise<FeatureExtractionPipeline> {
  pipePromise ??= pipeline('feature-extraction', EMBED_MODEL) as Promise<FeatureExtractionPipeline>;
  return pipePromise;
}

/** Embed a single short string (e.g. a search query) → 384-dim unit vector. */
export async function embedQuery(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, POOLING_OPTS);
  return Array.from(output.data as Float32Array);
}
