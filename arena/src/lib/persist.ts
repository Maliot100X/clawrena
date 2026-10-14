// Arena -> Postgres persistence. Up to Phase 10 the arena lived only in Redis,
// which is why replay had nothing to play back. This is the event log.
import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { __adb?: PrismaClient };
export const adb = g.__adb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.__adb = adb;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureGame(slug: string) {
  return adb.game.upsert({
    where: { slug }, update: {},
    create: { slug, name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), kind: 'NATIVE' },
  });
}

async function ensureAgent(name: string, mindTier: string, personality: string) {
  const handle = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent');
  const existing = await adb.agent.findUnique({ where: { handle } });
  if (existing) return existing;
  const user = await adb.user.upsert({
    where: { handle: 'demo' }, update: {}, create: { handle: 'demo', points: 1000 },
  });
  return adb.agent.create({ data: { userId: user.id, name, handle,
    mindTier: mindTier as any, personality: personality.toUpperCase() as any } });
}

/** Open a Run row for a live arena run. Returns the DB run id (or null on failure). */
export async function persistRunStart(opts: {
  arenaRunId: string; agentName: string; gameSlug: string;
  mindTier: string; personality: string; seed: number;
}): Promise<string | null> {
  try {
    const [game, agent] = await Promise.all([
      ensureGame(opts.gameSlug), ensureAgent(opts.agentName, opts.mindTier, opts.personality),
    ]);
    // re-use the row if this arena run was already persisted
    const found = await adb.run.findFirst({ where: { id: opts.arenaRunId } });
    if (found) return found.id;
    try {
      const r = await adb.run.create({ data: {
        id: opts.arenaRunId, agentId: agent.id, gameId: game.id,
        status: 'LIVE', seed: BigInt(opts.seed), startedAt: new Date(),
      }});
      return r.id;
    } catch {
      // id collision / non-uuid arena id -> let Prisma assign one
      const r = await adb.run.create({ data: {
        agentId: agent.id, gameId: game.id, status: 'LIVE',
        seed: BigInt(opts.seed), startedAt: new Date(),
      }});
      return r.id;
    }
  } catch (e) {
    console.warn('[persist] runStart failed:', (e as Error).message.slice(0, 120));
    return null;
  }
}

/** Append a batch of run events. seq is per-run and monotonic. */
export async function persistEvents(dbRunId: string, events: { seq: number; type: string; payload: any }[]) {
  if (!events.length) return;
  try {
    await adb.runEvent.createMany({
      data: events.map(e => ({ runId: dbRunId, seq: e.seq, type: e.type, payload: e.payload })),
      skipDuplicates: true,
    });
  } catch (e) { console.warn('[persist] events failed:', (e as Error).message.slice(0, 120)); }
}

/** Finish the run + write the leaderboard row. */
export async function persistRunEnd(dbRunId: string, opts: {
  won: boolean; score: number; games: any; agentName: string; gameSlug: string;
  thoughts: { text: string; provider: string }[];
}) {
  try {
    const run = await adb.run.findUnique({ where: { id: dbRunId } });
    if (!run) return;
    await adb.run.update({ where: { id: dbRunId }, data: {
      status: 'FINISHED', result: opts.won ? 'won' : 'lost',
      score: opts.score, endedAt: new Date(),
    }});
    // chat/thought archive
    if (opts.thoughts?.length) {
      await adb.chatMessage.createMany({ data: opts.thoughts.map(t => ({
        runId: dbRunId, author: opts.agentName, body: t.text, kind: 'chat',
      })) });
    }
    // leaderboard
    await adb.leaderboardEntry.upsert({
      where: { gameId_runId: { gameId: run.gameId, runId: dbRunId } },
      update: { score: opts.score },
      create: { gameId: run.gameId, agentId: run.agentId, runId: dbRunId, score: opts.score },
    });
    // denormalized agent counters (the card stats)
    const agg = await adb.run.findMany({ where: { agentId: run.agentId },
      select: { status: true, result: true } });
    const finished = agg.filter(a => a.status === 'FINISHED').length;
    const wins = agg.filter(a => a.result === 'won').length;
    const games = new Set((await adb.run.findMany({ where: { agentId: run.agentId },
      select: { gameId: true } })).map(g => g.gameId)).size;
    await adb.agent.update({ where: { id: run.agentId }, data: {
      runsCount: agg.length, winsCount: wins, gamesCount: games,
    }});
  } catch (e) { console.warn('[persist] runEnd failed:', (e as Error).message.slice(0, 120)); }
}
