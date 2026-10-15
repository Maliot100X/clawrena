import { NextResponse } from 'next/server';

const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';

// What the running agent is doing RIGHT NOW: its steer + latest line.
// The game polls this and applies `steer` to the on-screen character, so the
// browser shows OUR agent playing OUR game with the real LLM.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const r = await fetch(`${ARENA}/runs/${id}`, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ error: 'run not found' }, { status: r.status });
    const s = await r.json();
    // the arena exposes the latest brain bias + thought on the run state
    const steer = s.lastBias ?? s.bias ?? { dx: 0, dy: 0 };
    const say = Array.isArray(s.thoughts) && s.thoughts.length
      ? s.thoughts[s.thoughts.length - 1]?.text : undefined;
    return NextResponse.json({ steer, say, tick: s.tick, level: s.level, alive: s.alive });
  } catch (e: any) {
    return NextResponse.json({ error: 'arena unreachable', detail: e.message }, { status: 502 });
  }
}
