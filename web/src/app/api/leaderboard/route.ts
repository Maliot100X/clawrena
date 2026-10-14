import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('game');
  const game = slug ? await db.game.findUnique({ where: { slug } }) : null;

  const top = await db.leaderboardEntry.findMany({
    ...(game ? { where: { gameId: game.id } } : {}),
    orderBy: { score: 'desc' },
    take: 25,
  });

  // resolve agent + game separately so the query type stays simple and portable
  const runIds = top.map(t => t.runId);
  const runs = await db.run.findMany({
    where: { id: { in: runIds } },
    select: { id: true, result: true,
      agent: { select: { name: true, handle: true, rarity: true, level: true } },
      game:  { select: { name: true, slug: true } } },
  });
  const byId = new Map(runs.map(r => [r.id, r]));

  return NextResponse.json({
    game: game ? { slug: game.slug, name: game.name } : null,
    top: top.map(t => {
      const r = byId.get(t.runId);
      return {
        score: t.score, runId: t.runId,
        agent: r?.agent.name ?? '?', handle: r?.agent.handle ?? '?',
        rarity: r?.agent.rarity ?? 'COMMON', level: r?.agent.level ?? 1,
        game: r?.game.name ?? '?', gameSlug: r?.game.slug ?? '?',
        result: r?.result ?? null,
      };
    }),
  });
}
