import { db } from './db';

export async function getGames() {
  return db.game.findMany({ orderBy: { name: 'asc' } });
}
export async function getGame(slug: string) {
  return db.game.findUnique({ where: { slug } });
}
export async function getAgents(limit = 12) {
  // never surface soft-deleted demo agents
  return db.agent.findMany({
    where: { NOT: { tagline: { contains: '[hidden-demo]' } } },
    orderBy: { createdAt: 'desc' }, take: limit,
  });
}
export async function getAgent(handle: string) {
  return db.agent.findUnique({
    where: { handle },
    include: { wallet: { select: { solanaPub: true } } },
  });
}
export async function getLiveRuns() {
  return db.run.findMany({
    where: { status: 'LIVE' },
    include: { agent: true, game: true },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
}
export async function getOpenMarkets(limit = 10) {
  return db.market.findMany({
    where: { status: 'OPEN' },
    include: { run: { include: { agent: true, game: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
