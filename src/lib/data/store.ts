/**
 * Server-side data store. Lazily reads the committed JSON artifacts once and
 * caches them in module scope (they're static at runtime). Re-running the
 * scraper/embedder + restarting the dev server picks up new data.
 */
import 'server-only';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Yacht, EmbeddingRecord } from '@/types/yacht';

interface Store {
  yachts: Yacht[];
  byId: Map<string, Yacht>;
  vectors: Map<string, number[]>;
  destinations: string[];
}

let cache: Store | null = null;

async function load(): Promise<Store> {
  if (cache) return cache;
  const dir = resolve(process.cwd(), 'data');
  const [yachtsRaw, embRaw] = await Promise.all([
    readFile(resolve(dir, 'yachts.json'), 'utf-8'),
    readFile(resolve(dir, 'embeddings.json'), 'utf-8').catch(() => '[]'),
  ]);
  const yachts: Yacht[] = JSON.parse(yachtsRaw);
  const embeddings: EmbeddingRecord[] = JSON.parse(embRaw);
  const byId = new Map(yachts.map((y) => [y.id, y]));
  const vectors = new Map(embeddings.map((e) => [e.id, e.vector]));
  const destinations = Array.from(
    new Set(yachts.map((y) => y.destination).filter((d): d is string => !!d)),
  );
  cache = { yachts, byId, vectors, destinations };
  return cache;
}

export async function getStore(): Promise<Store> {
  return load();
}

export async function getYachts(): Promise<Yacht[]> {
  return (await load()).yachts;
}

export async function getYachtById(id: string): Promise<Yacht | null> {
  return (await load()).byId.get(id) ?? null;
}

export async function getVector(id: string): Promise<number[] | null> {
  return (await load()).vectors.get(id) ?? null;
}
