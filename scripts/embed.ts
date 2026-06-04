/**
 * Offline embedding generation.
 *
 *   npm run embed
 *
 * Reads data/yachts.json, composes each yacht's text, embeds it with the SAME
 * model + pooling/normalize options the runtime query embedder uses (shared via
 * src/lib/embeddings/config.ts), and writes data/embeddings.json.
 *
 * Does NOT import embedder.ts (that file is server-only and would throw here).
 */
import { pipeline, env } from '@huggingface/transformers';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { EMBED_MODEL, EMBED_DIM, POOLING_OPTS } from '../src/lib/embeddings/config.ts';
import { composeYachtText } from '../src/lib/embeddings/compose.ts';
import type { Yacht, EmbeddingRecord } from '../src/types/yacht.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');

env.cacheDir = '.models';

function l2norm(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

async function main() {
  const yachtsPath = resolve(DATA_DIR, 'yachts.json');
  const yachts: Yacht[] = JSON.parse(await readFile(yachtsPath, 'utf-8'));
  console.log(`Embedding ${yachts.length} yachts with ${EMBED_MODEL}...`);

  const pipe = await pipeline('feature-extraction', EMBED_MODEL);
  const records: EmbeddingRecord[] = [];

  for (const y of yachts) {
    const text = composeYachtText(y);
    const out = await pipe(text, POOLING_OPTS);
    const vector = Array.from(out.data as Float32Array);
    if (vector.length !== EMBED_DIM) {
      throw new Error(`Unexpected dim ${vector.length} for ${y.id} (expected ${EMBED_DIM})`);
    }
    records.push({ id: y.id, vector });
    console.log(`  ${y.id}: dim=${vector.length}, |v|=${l2norm(vector).toFixed(4)}`);
  }

  const out = resolve(DATA_DIR, 'embeddings.json');
  await writeFile(out, JSON.stringify(records), 'utf-8');
  console.log(`\nDone. Wrote ${records.length} vectors to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
