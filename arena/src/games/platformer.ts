// ClawRena native game: deterministic seeded platformer.
// Built from the platformer genre skill: derive jump physics from a target
// jump height + air time instead of magic numbers, gaps to clear, a goal.
// The agent steers with bias.dx (run) and bias.dy<0 (jump).
import type { BaseGameState, GameConfig, GameEngine } from './types.js';

export interface PlatformState extends BaseGameState {
  x: number; y: number;
  vy: number; grounded: boolean;
  platforms: { x: number; w: number }[];
  goalX: number;
  best: number;
}

// Jump feel: reach 3 tiles high in ~0.6s. y-axis points DOWN (per the skill).
const JUMP_H = 3, JUMP_T = 0.6;
const GRAVITY = (8 * JUMP_H) / (JUMP_T * JUMP_T);
const JUMP_V = (4 * JUMP_H) / JUMP_T;
const DT = 0.25;                       // one tick = 250ms

export class Platformer implements GameEngine<PlatformState> {
  state: PlatformState;
  cfg: GameConfig;
  private rng: () => number;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = mulberry32(cfg.seed);
    const platforms = [{ x: 0, w: 4 }];
    let cx = 5;
    const span = Math.floor((cfg.w - 6) / 6);
    for (let i = 0; i < span; i++) {
      platforms.push({ x: cx, w: 2 + Math.floor(this.rng() * 3) });
      cx += 4 + Math.floor(this.rng() * 3);
    }
    this.state = {
      tick: 0, level: 1, hp: 3, maxHp: 3, kills: 0, gold: 0, elapsedMs: 0,
      alive: true, x: 0, y: 0, vy: 0, grounded: true,
      platforms, goalX: cx, best: 0, log: ['run!'],
    };
  }

  step(bias: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
    const s = this.state;
    if (!s.alive) return s;
    s.tick += 1; s.elapsedMs += 250;

    // run
    if (bias.dx) s.x = Math.max(0, s.x + Math.sign(bias.dx));
    // jump only when grounded
    if (bias.dy < 0 && s.grounded) { s.vy = -JUMP_V; s.grounded = false; }

    // integrate
    s.vy += GRAVITY * DT;
    s.y += s.vy * DT;

    // land on a platform?
    const ground = s.platforms.find(p => s.x >= p.x && s.x < p.x + p.w);
    if (ground && s.y >= 0) { s.y = 0; s.vy = 0; s.grounded = true; }
    else if (!ground && s.y >= 0) { s.grounded = false; }

    // fell into a gap
    if (s.y > 4) {
      s.hp -= 1;
      s.log.push('fell (-1 hp)');
      // respawn at last platform
      const last = s.platforms.filter(p => p.x <= s.x).pop() ?? s.platforms[0];
      s.x = last.x; s.y = 0; s.vy = 0; s.grounded = true;
      if (s.hp <= 0) { s.hp = 0; s.alive = false; s.log.push('out of lives'); }
    }

    // progress -> levels
    s.best = Math.max(s.best, s.x);
    const lvl = Math.min(this.cfg.targetLevel, 1 + Math.floor(s.best / 5));
    if (lvl > s.level) { s.level = lvl; s.gold += 10; s.log.push(`checkpoint ${s.x}m`); }

    // reached the goal
    if (s.x >= s.goalX) { s.alive = false; s.log.push('goal reached'); }
    if (s.log.length > 40) s.log = s.log.slice(-40);
    return s;
  }

  get finished() { return !this.state.alive; }
  get won() { return this.state.x >= this.state.goalX; }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
