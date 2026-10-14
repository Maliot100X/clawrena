// ClawRena native game: deterministic seeded survival/crafting.
// Built from the survival-crafting genre skill: needs decay over time with
// graded consequences — low hunger bleeds HP; gather food to restore it.
// The agent steers with bias.dx/dy to move toward the nearest resource.
import type { BaseGameState, GameConfig, GameEngine } from './types.js';

export interface SurvState extends BaseGameState {
  x: number; y: number;
  hunger: number; thirst: number;   // 0..100, decay over time
  resources: { x: number; y: number; kind: 'food' | 'water' }[];
  daysSurvived: number;
}

const NEED_MAX = 100;
const DECAY = 2;                    // per tick, hunger + thirst

export class Survival implements GameEngine<SurvState> {
  state: SurvState;
  cfg: GameConfig;
  private rng: () => number;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = mulberry32(cfg.seed);
    const resources: SurvState['resources'] = [];
    for (let i = 0; i < 14; i++) {
      resources.push({
        x: Math.floor(this.rng() * cfg.w),
        y: Math.floor(this.rng() * cfg.h),
        kind: this.rng() < 0.5 ? 'food' : 'water',
      });
    }
    this.state = {
      tick: 0, level: 1, hp: NEED_MAX, maxHp: NEED_MAX, kills: 0, gold: 0,
      elapsedMs: 0, alive: true,
      x: Math.floor(cfg.w / 2), y: Math.floor(cfg.h / 2),
      hunger: NEED_MAX, thirst: NEED_MAX, resources, daysSurvived: 0,
      log: ['the sun rises'],
    };
  }

  step(bias: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
    const s = this.state;
    if (!s.alive) return s;
    s.tick += 1; s.elapsedMs += 250;

    // --- move toward the agent's bias -------------------------------------
    s.x = Math.min(this.cfg.w - 1, Math.max(0, s.x + Math.sign(bias.dx)));
    s.y = Math.min(this.cfg.h - 1, Math.max(0, s.y + Math.sign(bias.dy)));

    // --- needs decay with graded consequences ------------------------------
    s.hunger = Math.max(0, s.hunger - DECAY);
    s.thirst = Math.max(0, s.thirst - DECAY);
    if (s.hunger === 0) s.hp -= 1;
    if (s.thirst === 0) s.hp -= 2;          // thirst is worse — the skill's rule

    // --- gather what you're standing on ------------------------------------
    const here = s.resources.find(r => r.x === s.x && r.y === s.y);
    if (here) {
      if (here.kind === 'food') { s.hunger = NEED_MAX; s.log.push('ate — hunger restored'); }
      else { s.thirst = NEED_MAX; s.log.push('drank — thirst restored'); }
      s.gold += 5;
      s.resources = s.resources.filter(r => r !== here);
      // respawn a resource elsewhere so the world keeps going
      s.resources.push({
        x: Math.floor(this.rng() * this.cfg.w),
        y: Math.floor(this.rng() * this.cfg.h),
        kind: this.rng() < 0.5 ? 'food' : 'water',
      });
    }

    // --- a day passes every 20 ticks; survive enough to win -----------------
    if (s.tick % 20 === 0) {
      s.daysSurvived += 1; s.kills += 1;
      const lvl = Math.min(this.cfg.targetLevel, s.daysSurvived);
      if (lvl > s.level) { s.level = lvl; s.log.push(`day ${s.daysSurvived}`); }
    }

    if (s.hp <= 0) { s.hp = 0; s.alive = false; s.log.push('perished'); }
    if (s.daysSurvived >= this.cfg.targetLevel) { s.alive = false; s.log.push('you survived'); }
    if (s.log.length > 40) s.log = s.log.slice(-40);
    s.hp = Math.max(0, Math.min(s.maxHp, s.hp));
    return s;
  }

  get finished() { return !this.state.alive; }
  get won() { return this.state.daysSurvived >= this.cfg.targetLevel; }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
