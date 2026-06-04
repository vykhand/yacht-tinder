import { NextResponse } from 'next/server';
import { recommend } from '@/lib/search/taste';

export const runtime = 'nodejs';

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const likedIds = strArray(b.likedIds);
  const dislikedIds = strArray(b.dislikedIds);
  const excludeIds = strArray(b.excludeIds);
  const limit = typeof b.limit === 'number' && b.limit > 0 ? Math.min(b.limit, 100) : 30;

  const deck = await recommend(likedIds, dislikedIds, excludeIds, limit);
  return NextResponse.json({ deck });
}
