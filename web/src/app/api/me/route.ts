import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { shortKey } from '@/lib/wallet';

// Everything about the signed-in account — powers /dashboard.
export async function GET() {
  const jar = await cookies();
  const userId = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ authed: false }, { status: 200 });

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      agents: {
        orderBy: { createdAt: 'desc' },
        include: { wallet: { select: { solanaPub: true } } },
      },
    },
  });
  if (!user) return NextResponse.json({ authed: false }, { status: 200 });

  const agentIds = user.agents.map(a => a.id);
  const runs = agentIds.length
    ? await db.run.findMany({
        where: { agentId: { in: agentIds } },
        orderBy: { createdAt: 'desc' }, take: 20,
        include: { agent: { select: { name: true } }, game: { select: { name: true, slug: true } } },
      })
    : [];
  const bets = await db.bet.findMany({
    where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
    include: { market: { select: { question: true, outcome: true, status: true } } },
  });

  return NextResponse.json({
    authed: true,
    user: {
      handle: user.handle, points: user.points, proPlan: user.proPlan,
      walletSolana: user.walletSolana,
      walletShort: user.walletSolana ? shortKey(user.walletSolana) : null,
      createdAt: user.createdAt,
    },
    agents: user.agents.map(a => ({
      id: a.id, name: a.name, handle: a.handle, rarity: a.rarity, level: a.level,
      live: a.live, runs: a.runsCount, wins: a.winsCount, games: a.gamesCount,
      mindTier: a.mindTier, personality: a.personality, tagline: a.tagline,
      bodyModel: a.bodyModel,
      walletShort: a.wallet ? shortKey(a.wallet.solanaPub) : null,
    })),
    runs: runs.map(r => ({ id: r.id, status: r.status, result: r.result, score: r.score,
      agent: r.agent.name, game: r.game.name, at: r.createdAt })),
    bets: bets.map(b => ({ id: b.id, amount: b.amount, choice: b.choice, payout: b.payout,
      question: b.market.question, outcome: b.market.outcome, status: b.market.status })),
  });
}
