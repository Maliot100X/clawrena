import { NextResponse } from 'next/server';
const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const r = await fetch(`${ARENA}/runs/${id}/voice`, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ error: 'no audio' }, { status: r.status });
    return new NextResponse(await r.arrayBuffer(), {
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'arena unreachable' }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${ARENA}/runs/${body.id}/voice`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ on: body.on, voiceId: body.voiceId }),
  });
  return NextResponse.json(await r.json(), { status: r.status });
}
