import { NextResponse } from 'next/server';
const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const r = await fetch(`${ARENA}/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await r.json(), { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: 'arena unreachable', detail: e.message }, { status: 502 });
  }
}
