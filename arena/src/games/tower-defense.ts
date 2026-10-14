// ClawRena native game: deterministic seeded tower defense.
// Built from the tower-defense genre skill: enemies path a lane toward the
// goal, towers auto-fire, gold from kills buys more towers, leaks cost lives.
// The agent steers by choosing where to spend attention: it biases placement
// and focus fire among lanes via `bias.dx` (lane) and `bias.dy` (build vs hold).
import type { BaseGameState, GameConfig, GameEngine } from './types.js';

export interface TowerState extends BaseGameState {
  lane: number;                 // the lane the agent is currently defending
  towers: { x: number; dmg: number; cd: number }[];
  enemies: { x: number; hp: number; lane: number }[];
  leaks: number;
  lives: number;
  wave: number;
}

const LANES = 3;
const LANE_LEN = 12;

export class TowerDefense implements GameEngine<TowerState> {
  state: TowerState;
  cfg: GameConfig;
  private rng: () => number;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = mulberry32(cfg.seed);
    this.state = {
      tick: 0, level: 1, hp: 100, maxHp: 100, kills: 0, gold: 40,
      elapsedMs: 0, alive: true,
      lane: 1, towers: [], enemies: [], leaks: 0, lives: 10, wave: 1,
      log: ['wave 1 incoming'],
    };
    this.spawnWave();
  }

  private spawnWave() {
    const n = 2 + this.state.wave;
    for (let i = 0; i < n; i++) {
      this.state.enemies.push({
        x: LANE_LEN + i,                       // start off the far end
        hp: 8 + this.state.wave * 4,
        lane: Math.floor(this.rng() * LANES),
      });
    }
  }

  step(bias: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
    const s = this.state;
    if (!s.alive) return s;
    s.tick += 1;
    s.elapsedMs += 250;

    // --- agent steering -------------------------------------------------
    // dx picks which lane to focus; dy > 0 builds a tower on that lane.
    if (bias.dx) s.lane = Math.min(LANES - 1, Math.max(0, s.lane + Math.sign(bias.dx)));
    if (bias.dy > 0 && s.gold >= 20) {
      s.gold -= 20;
      s.towers.push({ x: LANE_LEN - 2, dmg: 6, cd: 0, lane: s.lane } as any);
      s.log.push(`built tower on lane ${s.lane}`);
    }

    // --- enemies advance -------------------------------------------------
    for (const e of s.enemies) {
      e.x -= 1;                                 // one step closer to the goal
      if (e.x <= 0) {                           // leaked past the defense
        s.leaks += 1; s.lives -= 1; e.hp = 0;
        s.log.push(`LEAK on lane ${e.lane} (lives ${s.lives})`);
      }
    }

    // --- towers fire on the nearest enemy in their lane ------------------
    for (const t of (s.towers as any[])) {
      if (t.cd > 0) { t.cd -= 1; continue; }
      const target = s.enemies
        .filter(e => e.lane === t.lane && e.hp > 0)
        .sort((a, b) => a.x - b.x)[0];
      if (target) {
        target.hp -= t.dmg;
        t.cd = 2;
        if (target.hp <= 0) {
          s.kills += 1; s.gold += 5;
          s.log.push(`kill on lane ${target.lane}`);
        }
      }
    }

    // --- cleanup + wave progression --------------------------------------
    s.enemies = s.enemies.filter(e => e.hp > 0);
    if (s.enemies.length === 0) {
      s.wave += 1;
      const newLevel = Math.min(this.cfg.targetLevel, s.wave);
      if (newLevel > s.level) { s.level = newLevel; s.log.push(`wave ${s.wave}`); }
      if (s.wave <= this.cfg.targetLevel) this.spawnWave();
    }

    // --- end conditions ---------------------------------------------------
    if (s.lives <= 0) { s.lives = 0; s.alive = false; s.log.push('overrun'); }
    if (s.wave > this.cfg.targetLevel) { s.alive = false; s.log.push('all waves cleared'); }
    s.hp = Math.max(0, s.lives * 10);
    if (s.log.length > 40) s.log = s.log.slice(-40);
    return s;
  }

  get finished() { return !this.state.alive; }
  get won() { return this.state.wave > this.cfg.targetLevel; }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
