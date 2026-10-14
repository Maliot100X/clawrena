import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await db.run.findFirst({
    where: { OR: [{ id }, { id: id }] },
    include: {
      agent: { select: { name: true, handle: true, rarity: true, level: true } },
      game:  { select: { name: true, slug: true } },
      events: { orderBy: { seq: 'asc' } },
      messages: { orderBy: { at: 'asc' }, take: 100 },
      markets: { select: { question: true, pot: true, outcome: true, status: true } },
    },
  });
  if (!run) return NextResponse.json({ error: 'replay not found' }, { status: 404 });
  // BigInt (Run.seed) is not JSON-serializable — stringify it explicitly.
  const safe = {
    ...run,
    seed: run.seed != null ? String(run.seed) : null,
    events: run.events.map(e => ({
      seq: e.seq, type: e.type, payload: e.payload, at: e.at,
    })),
  };
  return NextResponse.json({ run: safe });
}
