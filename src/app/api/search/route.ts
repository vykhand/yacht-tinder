import { NextResponse } from 'next/server';
import { search } from '@/lib/search/semantic';

// Embeddings need the Node runtime (ONNX native addon) — never Edge.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const { query, limit } = (body ?? {}) as { query?: unknown; limit?: unknown };
  if (typeof query !== 'string' || !query.trim()) {
    return NextResponse.json({ error: 'query (non-empty string) is required' }, { status: 400 });
  }
  const lim = typeof limit === 'number' && limit > 0 ? Math.min(limit, 100) : 24;
  const { filters, results } = await search(query.trim(), lim);
  return NextResponse.json({ query: query.trim(), filters, results });
}
