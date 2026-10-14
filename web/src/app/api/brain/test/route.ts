import { NextResponse } from 'next/server';
// Live brain test for the create flow. Asks the arena to run one think() turn
// with a representative game state, so you see the real provider + reply.
const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    const r = await fetch(`${ARENA}/brain/test`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentName: b.agentName ?? 'agent', mindTier: b.mindTier ?? 'HUMAN',
        personality: b.personality ?? 'Daredevil', customMind: b.customMind }),
    });
    if (!r.ok) return NextResponse.json({ error: `brain ${r.status}` }, { status: 502 });
    return NextResponse.json(await r.json());
  } catch (e: any) {
    return NextResponse.json({ error: 'arena unreachable', detail: e.message }, { status: 502 });
  }
}
