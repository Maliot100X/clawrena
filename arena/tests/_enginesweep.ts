import { GAMES } from '../src/games/registry.js';

for (const g of GAMES) {
  const cfg = { w: 24, h: 16, seed: 55, targetLevel: 15 };
  const eng = g.make(cfg);
  let steps = 0;
  let nan = false;
  let neg = false;
  while (!eng.finished && steps < 20000) {
    const s = eng.step({ dx: 0, dy: 0 });
    if (!Number.isFinite(s.hp) || !Number.isFinite(s.tick) || !Number.isFinite(s.kills)) { nan = true; break; }
    if (s.hp < 0) neg = true;
    steps++;
  }
  const s = eng.state;
  console.log(
    `${g.slug.padEnd(15)} steps=${String(steps).padStart(5)} fin=${String(eng.finished).padEnd(5)} won=${String(eng.won).padEnd(5)} ` +
    `tick=${String(s.tick).padStart(5)} lvl=${s.level} hp=${s.hp} kills=${s.kills} gold=${s.gold} nan=${nan} negHp=${neg}`
  );
}
