// Phase 1 seed — one demo agent + the game catalog from recon.
import { PrismaClient } from '../generated/client/index.js';
const db = new PrismaClient();

const GAMES = [
  { slug: 'survivors-s2', name: 'Solana Survivors · Season 2', kind: 'IFRAME', embedUrl: 'https://play.solanasurvivors.fun/?agent=1&decisions=external&strategy=survivor', live: true },
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
