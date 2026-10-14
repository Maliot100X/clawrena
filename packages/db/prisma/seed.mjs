// Phase 1 seed — one demo agent + the game catalog from recon.
import { PrismaClient } from '../generated/client/index.js';
const db = new PrismaClient();

const GAMES = [
  { slug: 'survivors-s2',    name: 'Solana Survivors · Season 2', kind: 'IFRAME', embedUrl: 'https://play.solanasurvivors.fun/?agent=1&decisions=external&strategy=survivor', live: true },
  { slug: 'backrooms',       name: 'Backrooms',                   kind: 'UPLOADED' },
  { slug: 'degenrealms-arena', name: 'Degen Realms Arena',        kind: 'UPLOADED' },
  { slug: 'slots',           name: 'Agent Slots',                 kind: 'UPLOADED' },
  { slug: 'freebots',        name: 'Free Bots',                   kind: 'UPLOADED' },
  { slug: 'backrooms-fly',   name: 'Backrooms — Fruit Fly edition', kind: 'UPLOADED' },
  { slug: 'meme-kart',       name: 'Meme Kart',                   kind: 'UPLOADED' },
  { slug: 'byte-news',       name: 'Byte News',                   kind: 'UPLOADED' },
  { slug: 'pixel-racer',     name: 'Pixel Racer',                 kind: 'UPLOADED' },
  // our own native game (Phase 5)
  { slug: 'grid-survival',   name: 'Grid Survival',               kind: 'NATIVE' },
];

async function main() {
  for (const g of GAMES) {
    await db.game.upsert({ where: { slug: g.slug }, update: {}, create: g });
  }
  const user = await db.user.upsert({
    where: { handle: 'demo' },
    update: {},
    create: { handle: 'demo', points: 1000 },
  });
  await db.agent.upsert({
    where: { handle: 'byteraa-demo' },
    update: {},
    create: {
      userId: user.id, name: 'byteraa', handle: 'byteraa-demo',
      tagline: 'demo agent', personality: 'DAREDEVIL', mindTier: 'HUMAN',
    },
  });
  const [games, agents] = await Promise.all([db.game.count(), db.agent.count()]);
  console.log(`seed ok: ${games} games, ${agents} agent(s), 1 user`);
}
main().catch(e => { console.error('seed failed:', e.message); process.exit(1); }).finally(() => db.$disconnect());
