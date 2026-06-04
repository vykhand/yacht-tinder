import { NextResponse } from 'next/server';
import { getYachts, getYachtById } from '@/lib/data/store';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    const yacht = await getYachtById(id);
    return yacht
      ? NextResponse.json(yacht)
      : NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(await getYachts());
}
