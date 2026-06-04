/**
 * Small vector helpers. All embeddings from our pipeline are L2-normalized,
 * so cosine similarity reduces to a dot product.
 */

export function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

/** Cosine similarity; safe even if a vector isn't normalized. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

export function add(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + (b[i] ?? 0));
}

export function subtract(a: number[], b: number[]): number[] {
  return a.map((x, i) => x - (b[i] ?? 0));
}

export function scale(a: number[], k: number): number[] {
  return a.map((x) => x * k);
}

/** Element-wise mean of a list of equal-length vectors. Returns [] if empty. */
export function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  for (let i = 0; i < dim; i++) out[i] /= vectors.length;
  return out;
}

/** L2-normalize a vector to unit length. Returns the input if it's all zeros. */
export function normalize(v: number[]): number[] {
  const n = norm(v);
  return n === 0 ? v : v.map((x) => x / n);
}
