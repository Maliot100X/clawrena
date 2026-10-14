import { NextResponse } from 'next/server';
const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ thoughts: [], provider: null }, { status: 400 });
  try {
    const r = await fetch(`${ARENA}/runs/${id}/thoughts`, { cache: 'no-store' });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ thoughts: [], provider: null });
  }
}
