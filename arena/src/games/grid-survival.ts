// ClawRena native game: deterministic seeded grid survival.
// Mirrors the recon'd "Solana Survivors" shape (level, HP, kills, gold, time)
// without copying any third-party game code.
export interface GameState {
  tick: number; level: number; hp: number; maxHp: number;
  kills: number; gold: number; elapsedMs: number;
  x: number; y: number; alive: boolean;
  enemies: { x: number; y: number }[];
  log: string[];
}

export interface GameConfig { w: number; h: number; seed: number; targetLevel: number; }

export class GridSurvival {
  state: GameState;
  private rng: () => number;
  cfg: GameConfig;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = mulberry32(cfg.seed);
    this.state = {
      tick: 0, level: 1, hp: 100, maxHp: 100, kills: 0, gold: 0, elapsedMs: 0,
      x: Math.floor(cfg.w / 2), y: Math.floor(cfg.h / 2), alive: true,
      enemies: [], log: ['run started'],
    };
    this.spawn(3);
  }

  private spawn(n: number) {
    for (let i = 0; i < n; i++) {
      this.state.enemies.push({
        x: Math.floor(this.rng() * this.cfg.w),
        y: Math.floor(this.rng() * this.cfg.h),
      });
    }
  }

  /** advance one tick. `bias` lets an agent steer (dx,dy in -1..1). */
  step(bias: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
    const s = this.state;
    if (!s.alive) return s;
    s.tick += 1;
    s.elapsedMs += 250;

    // move toward agent bias, clamped to grid
    if (bias.dx || bias.dy) {
      s.x = Math.min(this.cfg.w - 1, Math.max(0, s.x + Math.sign(bias.dx)));
      s.y = Math.min(this.cfg.h - 1, Math.max(0, s.y + Math.sign(bias.dy)));
    }

    // enemies drift toward player (deterministic)
    for (const e of s.enemies) {
      if (this.rng() < 0.7) {
        e.x += Math.sign(s.x - e.x);
        e.y += Math.sign(s.y - e.y);
      }
    }

    // collisions
    const hit = s.enemies.filter(e => e.x === s.x && e.y === s.y);
    if (hit.length) {
      s.hp -= 12 * hit.length;
      s.enemies = s.enemies.filter(e => !(e.x === s.x && e.y === s.y));
      s.log.push(`hit for ${12 * hit.length} (hp ${Math.max(0, s.hp)})`);
    }

    // kills: any enemy adjacent to us dies
    const adjacent = s.enemies.filter(e => Math.abs(e.x - s.x) <= 1 && Math.abs(e.y - s.y) <= 1);
    if (adjacent.length) {
      s.kills += adjacent.length;
      s.gold += adjacent.length * 3;
      s.enemies = s.enemies.filter(e => !adjacent.includes(e));
      s.log.push(`killed ${adjacent.length}`);
    }

    // level up every 10 kills
    const newLevel = Math.min(this.cfg.targetLevel, 1 + Math.floor(s.kills / 10));
    if (newLevel > s.level) {
      s.level = newLevel; s.maxHp += 20; s.hp = s.maxHp;
      s.log.push(`level up -> ${s.level}`);
    }

    // keep the board populated
    if (s.enemies.length < 4) this.spawn(2);

    if (s.hp <= 0) { s.hp = 0; s.alive = false; s.log.push('died'); }
    if (s.level >= this.cfg.targetLevel) { s.alive = false; s.log.push('reached target level'); }
    if (s.log.length > 40) s.log = s.log.slice(-40);
    return s;
  }

  get finished() { return !this.state.alive; }
  get won() { return this.state.level >= this.cfg.targetLevel; }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
