import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { generateWallet, shortKey } from '@/lib/wallet';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { rateLimit, clientKey } from '@/lib/ratelimit';

// List agents. Signed in -> only YOUR agents. Anonymous -> the public showcase.
export async function GET() {
  const jar = await cookies();
  const uid = await readSession(jar.get(SESSION_COOKIE)?.value);

  const SEL = { id:true, name:true, handle:true, rarity:true, level:true,
      runsCount:true, winsCount:true, gamesCount:true, live:true,
      mindTier:true, personality:true, tagline:true, bodyModel:true,
      wallet: { select: { solanaPub: true } } } as const;

  // hide soft-deleted demo agents from both the public list and the dashboard
  const notHidden = { NOT: { tagline: { contains: '[hidden-demo]' } } };
  const agents = uid
    ? await db.agent.findMany({ where: { userId: uid, ...notHidden },
        orderBy: { createdAt: 'desc' }, take: 50, select: SEL })
    : await db.agent.findMany({ where: { live: true, ...notHidden },
        orderBy: { createdAt: 'desc' }, take: 50, select: SEL });
  return NextResponse.json({
    agents: agents.map(({ wallet, ...a }) => ({ ...a,
      walletShort: wallet ? shortKey(wallet.solanaPub) : null })),
    scope: uid ? 'mine' : 'public',
  });
}

export async function POST(req: Request) {
  const jar = await cookies();
  const uid = await readSession(jar.get(SESSION_COOKIE)?.value);
  // You MUST be signed in to own an agent — that is what makes it appear in
  // your dashboard instead of vanishing into a demo account.
  if (!uid) return NextResponse.json({ error: 'sign in with your wallet first' }, { status: 401 });

  const rl = await rateLimit(`agents:${uid}:${clientKey(req)}`, { limit: 10, windowSec: 60 });
  if (!rl.ok) return NextResponse.json({ error: 'rate limited' },
    { status: 429, headers: { 'retry-after': '60' } });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (name.length > 24) return NextResponse.json({ error: 'name too long (max 24)' }, { status: 400 });

  const owner = await db.user.findUnique({ where: { id: uid } });
  if (!owner) return NextResponse.json({ error: 'session invalid' }, { status: 401 });

  // unique handle
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
  let handle = base, n = 1;
  while (await db.agent.findUnique({ where: { handle } })) handle = `${base}-${++n}`;

  // every agent gets its OWN wallet
  const w = generateWallet();

  const agent = await db.agent.create({
    data: {
      userId: owner.id,                 // <- YOUR account
      name, handle,
      tagline: b.tagline ?? null,
      mindTier: b.mindTier ?? 'HUMAN',
      personality: b.personality ?? 'DAREDEVIL',
      customMind: b.customMind ?? null,
      scene: b.scene ?? 'studio',
      aura: b.aura ?? 'auto',
      bodyModel: b.bodyModel ?? null,
      voiceId: b.voiceId ?? null,
      voiceTier: b.voiceTier ?? 'SERVER_DEFAULT',
      language: b.language ?? 'en',
      wallet: { create: { solanaPub: w.publicKey, encSecret: w.encSecret } },
    },
    select: { id:true, name:true, handle:true, rarity:true, level:true,
      mindTier:true, personality:true, bodyModel:true,
      wallet: { select: { solanaPub: true } } },
  });

  const { wallet, ...rest } = agent;
  return NextResponse.json({
    ok: true,
    agent: { ...rest, walletShort: wallet ? shortKey(wallet.solanaPub) : null },
  }, { status: 201 });
}
