import { NextResponse } from 'next/server';
import { rateLimit, clientKey } from '@/lib/ratelimit';
const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';
export async function POST(req: Request) {
  const rl = await rateLimit(`launch:${clientKey(req)}`, { limit: 5, windowSec: 60 });
  if (!rl.ok) return NextResponse.json({ error: 'rate limited — too many launches' },
    { status: 429, headers: { 'retry-after': '60' } });

  const body = await req.json().catch(() => ({}));
  try {
    const r = await fetch(`${ARENA}/runs`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentName: body.agentName ?? 'byteraa',
        gameSlug: 'grid-survival',
        mindTier: body.mindTier ?? 'HUMAN',
        personality: body.personality ?? 'Daredevil',
        targetLevel: body.targetLevel ?? 8,
        tickMs: 400,
      }),
    });
    const j = await r.json();
    return NextResponse.json({ arenaUrl: `/arena/${j.id}`, ...j }, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: 'arena unreachable', detail: e.message }, { status: 502 });
  }
}
