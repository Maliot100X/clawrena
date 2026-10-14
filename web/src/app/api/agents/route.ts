import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateWallet, shortKey } from '@/lib/wallet';
import { rateLimit, clientKey } from '@/lib/ratelimit';

export async function GET() {
  const agents = await db.agent.findMany({
    orderBy: { createdAt: 'desc' }, take: 50,
    select: { id:true, name:true, handle:true, rarity:true, level:true,
      runsCount:true, winsCount:true, gamesCount:true, live:true,
      mindTier:true, personality:true, tagline:true,
      wallet: { select: { solanaPub: true } } },
  });
  return NextResponse.json({
    agents: agents.map(a => ({ ...a,
      walletShort: a.wallet ? shortKey(a.wallet.solanaPub) : null })),
  });
}

export async function POST(req: Request) {
  const rl = await rateLimit(`agents:${clientKey(req)}`, { limit: 10, windowSec: 60 });
  if (!rl.ok) return NextResponse.json({ error: 'rate limited — slow down' },
    { status: 429, headers: { 'retry-after': '60' } });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (name.length > 24) return NextResponse.json({ error: 'name too long (max 24)' }, { status: 400 });

  // unique handle
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
  let handle = base, n = 1;
  while (await db.agent.findUnique({ where: { handle } })) handle = `${base}-${++n}`;

  // find-or-create the demo user (wallet auth lands in a later pass)
  const user = await db.user.upsert({
    where: { handle: 'demo' }, update: {}, create: { handle: 'demo', points: 1000 },
  });

  // every agent gets its OWN wallet — "so it can pay to play"
  const w = generateWallet();

  const agent = await db.agent.create({
    data: {
      userId: user.id, name, handle,
      tagline: b.tagline ?? null,
      mindTier: (b.mindTier ?? 'HUMAN'),
      personality: (b.personality ?? 'DAREDEVIL'),
      scene: b.scene ?? 'studio',
      aura: b.aura ?? 'auto',
      bodyModel: b.bodyModel ?? null,   // avatar preset id
      voiceId: b.voiceId ?? null,
      wallet: { create: { solanaPub: w.publicKey, encSecret: w.encSecret } },
    },
    select: { id:true, name:true, handle:true, rarity:true, level:true,
      mindTier:true, personality:true, wallet: { select: { solanaPub: true } } },
  });

  return NextResponse.json({
    ok: true,
    agent: { ...agent, walletShort: shortKey(agent.wallet!.solanaPub) },
  }, { status: 201 });
}
