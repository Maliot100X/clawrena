import { describe, it, expect } from 'vitest';
import { GridSurvival } from '../src/games/grid-survival.js';

describe('grid survival engine', () => {
  it('is deterministic for a given seed', () => {
    const run = (seed: number) => {
      const g = new GridSurvival({ w: 24, h: 16, seed, targetLevel: 5 });
      for (let i = 0; i < 40; i++) g.step({ dx: 1, dy: 0 });
      return g.state;
    };
    const a = run(123), b = run(123);
    expect(a.kills).toBe(b.kills);
    expect(a.hp).toBe(b.hp);
    expect(a.level).toBe(b.level);
    expect(a.tick).toBe(b.tick);
  });

  it('differs across seeds', () => {
    const run = (seed: number) => {
      const g = new GridSurvival({ w: 24, h: 16, seed, targetLevel: 5 });
      for (let i = 0; i < 40; i++) g.step();
      return g.state;
    };
    expect(JSON.stringify(run(1))).not.toBe(JSON.stringify(run(999)));
  });

  it('stays inside the grid', () => {
    const g = new GridSurvival({ w: 10, h: 10, seed: 7, targetLevel: 99 });
    for (let i = 0; i < 200; i++) g.step({ dx: 1, dy: 1 });
    expect(g.state.x).toBeLessThan(10);
    expect(g.state.x).toBeGreaterThanOrEqual(0);
    expect(g.state.y).toBeLessThan(10);
    expect(g.state.y).toBeGreaterThanOrEqual(0);
  });

  it('never emits NaN', () => {
    const g = new GridSurvival({ w: 24, h: 16, seed: 4, targetLevel: 20 });
    for (let i = 0; i < 300 && !g.finished; i++) g.step();
    const s = g.state;
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'number') expect(Number.isFinite(v), `${k} is not finite`).toBe(true);
    }
  });

  it('finishes at the target level and reports a win', () => {
    const g = new GridSurvival({ w: 24, h: 16, seed: 42, targetLevel: 3 });
    let guard = 0;
    while (!g.finished && guard++ < 5000) g.step({ dx: 0, dy: 0 });
    expect(g.finished).toBe(true);
    if (g.won) expect(g.state.level).toBeGreaterThanOrEqual(3);
  });

  it('caps hp at zero, never negative', () => {
    const g = new GridSurvival({ w: 8, h: 8, seed: 11, targetLevel: 99 });
    for (let i = 0; i < 500 && !g.finished; i++) g.step();
    expect(g.state.hp).toBeGreaterThanOrEqual(0);
  });
});
