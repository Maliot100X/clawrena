// ClawRena native game: deterministic seeded roguelike.
// Built from the roguelike genre skill (Berlin Interpretation core): a
// procedurally generated grid dungeon, turn-based movement, permadeath, and a
// run economy. The agent steers one turn at a time with `bias.dx/dy`.
import type { BaseGameState, GameConfig, GameEngine } from './types.js';

export interface RogueState extends BaseGameState {
  x: number; y: number;
  depth: number;                    // dungeon level
  floor: number[][];                // 0 floor, 1 wall, 2 gold, 3 stairs
  revealed: boolean[][];
  mobs: { x: number; y: number; hp: number }[];
}

const W = 12, H = 8;

export class Roguelike implements GameEngine<RogueState> {
  state: RogueState;
  cfg: GameConfig;
  private rng: () => number;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = mulberry32(cfg.seed);
    this.state = {
      tick: 0, level: 1, hp: 30, maxHp: 30, kills: 0, gold: 0,
      elapsedMs: 0, alive: true,
      x: 1, y: 1, depth: 1, floor: [], revealed: [], mobs: [],
      log: ['you descend into the dungeon'],
    };
    this.genFloor();
  }

  /** procedural floor: rooms, walls, gold, stairs, mobs. */
  private genFloor() {
    const s = this.state;
    s.floor = Array.from({ length: H }, () => Array(W).fill(0));
    s.revealed = Array.from({ length: H }, () => Array(W).fill(false));
    // border walls
    for (let x = 0; x < W; x++) { s.floor[0][x] = 1; s.floor[H - 1][x] = 1; }
    for (let y = 0; y < H; y++) { s.floor[y][0] = 1; s.floor[y][W - 1] = 1; }
    // a few scattered pillars for texture
    for (let i = 0; i < 8; i++) {
      const px = 2 + Math.floor(this.rng() * (W - 4));
      const py = 2 + Math.floor(this.rng() * (H - 4));
      s.floor[py][px] = 1;
    }
    // gold + stairs
    for (let i = 0; i < 5; i++) {
      const gx = 1 + Math.floor(this.rng() * (W - 2));
      const gy = 1 + Math.floor(this.rng() * (H - 2));
      if (s.floor[gy][gx] === 0) s.floor[gy][gx] = 2;
    }
    s.floor[H - 2][W - 2] = 3;   // stairs far corner
    // mobs scale with depth
    s.mobs = [];
    const n = 2 + s.depth;
    for (let i = 0; i < n; i++) {
      const mx = 2 + Math.floor(this.rng() * (W - 4));
      const my = 2 + Math.floor(this.rng() * (H - 4));
      if (s.floor[my][mx] === 0) s.mobs.push({ x: mx, y: my, hp: 3 + s.depth });
    }
    s.x = 1; s.y = 1;
    this.reveal();
  }

  /** simple field of view: reveal what is adjacent. */
  private reveal() {
    const s = this.state;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = s.x + dx, ny = s.y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) s.revealed[ny][nx] = true;
      }
    }
  }

  step(bias: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
    const s = this.state;
    if (!s.alive) return s;
    s.tick += 1;
    s.elapsedMs += 250;

    // --- agent moves one tile -------------------------------------------
    // A passive agent (dx=dy=0) must still make progress toward the stairs, or
    // the run never descends and its markets never settle. When the agent gives
    // no direction, walk toward the stairs in the far corner.
    let mx = Math.sign(bias.dx);
    let my = Math.sign(bias.dy);
    if (mx === 0 && my === 0) {
      mx = Math.sign((W - 2) - s.x);
      my = Math.sign((H - 2) - s.y);
    }
    // if the diagonal is blocked, try each axis alone so we slide along walls
    const canStep = (ax: number, ay: number) => {
      const tx = s.x + ax, ty = s.y + ay;
      return ax !== 0 || ay !== 0
        ? tx >= 0 && ty >= 0 && tx < W && ty < H && s.floor[ty][tx] !== 1
        : false;
    };
    if (canStep(mx, my)) { s.x += mx; s.y += my; }
    else if (canStep(mx, 0)) { s.x += mx; }
    else if (canStep(0, my)) { s.y += my; }

    // --- pick up gold -----------------------------------------------------
    if (s.floor[s.y][s.x] === 2) {
      s.gold += 10; s.floor[s.y][s.x] = 0;
      s.log.push(`gold +10 (${s.gold})`);
    }

    // --- combat: attack an adjacent mob ----------------------------------
    const near = s.mobs.find(m => Math.abs(m.x - s.x) <= 1 && Math.abs(m.y - s.y) <= 1);
    if (near) {
      near.hp -= 2;
      if (near.hp <= 0) {
        s.kills += 1;
        s.mobs = s.mobs.filter(m => m !== near);
        s.log.push('mob slain');
      } else {
        s.hp -= 1;                              // it hits back
      }
    }

    // --- mobs step toward the player -------------------------------------
    for (const m of s.mobs) {
      m.x += Math.sign(s.x - m.x);
      m.y += Math.sign(s.y - m.y);
      if (m.x === s.x && m.y === s.y) { s.hp -= 2; s.log.push('bitten (-2 hp)'); }
    }

    this.reveal();

    // --- stairs: descend, level up ----------------------------------------
    if (s.floor[s.y][s.x] === 3) {
      s.depth += 1;
      const newLevel = Math.min(this.cfg.targetLevel, s.depth);
      if (newLevel > s.level) { s.level = newLevel; s.log.push(`depth ${s.depth}`); }
      s.gold += 15;
      if (s.depth <= this.cfg.targetLevel) this.genFloor();
    }

    // --- end conditions ----------------------------------------------------
    if (s.hp <= 0) { s.hp = 0; s.alive = false; s.log.push('you died'); }
    if (s.depth > this.cfg.targetLevel) { s.alive = false; s.log.push('escaped the dungeon'); }
    if (s.log.length > 40) s.log = s.log.slice(-40);
    return s;
  }

  get finished() { return !this.state.alive; }
  get won() { return this.state.depth > this.cfg.targetLevel; }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
