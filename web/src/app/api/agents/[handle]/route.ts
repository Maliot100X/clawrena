import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shortKey } from '@/lib/wallet';

export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  const a = await db.agent.findUnique({
    where: { handle: decodeURIComponent(handle) },
    include: { wallet: { select: { solanaPub: true } } },
  });
  if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // NOTE: encSecret is never selected/returned.
  return NextResponse.json({ agent: { ...a,
    walletShort: a.wallet ? shortKey(a.wallet.solanaPub) : null,
    wallet: undefined } });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;
  const a = await db.agent.findUnique({ where: { handle: decodeURIComponent(handle) } });
  if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await db.agent.delete({ where: { id: a.id } });   // wallet cascades
  return NextResponse.json({ deleted: a.handle });
}
