// THE game. A real survivors engine driven by the agent's LLM.
// The brain steers the hero (bias dx/dy); the engine runs the world:
// zombie waves, XP gems with magnet, level-ups. Deterministic per seed.
import type { BaseGameState, GameConfig, GameEngine } from './types.js';

export interface SurvivorsState extends BaseGameState {
  x: number; y: number;
  xp: number; need: number;
  wave: number;
  zombies: { x: number; y: number; hp: number; tier: number }[];
  gems: { x: number; y: number }[];
  scene: 'field' | 'cleared';
}

const W = 48, H = 30;

export class Survivors implements GameEngine<SurvivorsState> {
  state: SurvivorsState;
  cfg: GameConfig;
  private rng: () => number;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = mulberry32(cfg.seed);
    this.state = {
      tick: 0, level: 1, hp: 100, maxHp: 100, kills: 0, gold: 0,
      elapsedMs: 0, alive: true,
      x: Math.floor(W/2), y: Math.floor(H/2),
      xp: 0, need: 5, wave: 1, zombies: [], gems: [], scene: 'field',
      log: ['the horde stirs…'],
    };
    this.spawnWave();
  }

  private spawnWave() {
    const n = 3 + this.state.wave * 2;
    for (let i = 0; i < n; i++) {
      const edge = Math.floor(this.rng() * 4);
      let x = 0, y = 0;
      if (edge === 0) { x = Math.floor(this.rng()*W); y = 0; }
      else if (edge === 1) { x = Math.floor(this.rng()*W); y = H-1; }
      else if (edge === 2) { x = 0; y = Math.floor(this.rng()*H); }
      else { x = W-1; y = Math.floor(this.rng()*H); }
      const tier = this.rng() < 0.25 ? 2 : 1;
      this.state.zombies.push({ x, y, hp: tier === 2 ? 6 : 3, tier });
    }
  }

  step(bias: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
    const s = this.state;
    if (!s.alive) return s;
    s.tick += 1; s.elapsedMs += 250;

    // --- hero moves on the agent's steer ---------------------------------
    s.x = Math.min(W-1, Math.max(0, s.x + Math.sign(bias.dx)));
    s.y = Math.min(H-1, Math.max(0, s.y + Math.sign(bias.dy)));

    // --- zombies chase -----------------------------------------------------
    for (const z of s.zombies) {
      if (this.rng() < 0.8) {
        z.x += Math.sign(s.x - z.x);
        z.y += Math.sign(s.y - z.y);
      }
      if (z.x === s.x && z.y === s.y) {
        s.hp -= z.tier === 2 ? 10 : 5;
        s.log.push(`zombie hits (-${z.tier === 2 ? 10 : 5} hp)`);
      }
    }

    // --- auto-attack adjacent zombies -------------------------------------
    const adj = s.zombies.filter(z => Math.abs(z.x-s.x) <= 1 && Math.abs(z.y-s.y) <= 1);
    for (const z of adj) {
      z.hp -= 3;
      if (z.hp <= 0) {
        s.gems.push({ x: z.x, y: z.y });
        s.kills += 1;
      }
    }
    s.zombies = s.zombies.filter(z => z.hp > 0);

    // --- gems magnet + pickup ---------------------------------------------
    for (const g of s.gems) {
      if (Math.abs(g.x-s.x) <= 6 && Math.abs(g.y-s.y) <= 6) {
        g.x += Math.sign(s.x-g.x); g.y += Math.sign(s.y-g.y);
      }
      if (g.x === s.x && g.y === s.y) { s.xp += 1; g.x = -99; }
    }
    s.gems = s.gems.filter(g => g.x !== -99);

    // --- level up ----------------------------------------------------------
    if (s.xp >= s.need) {
      s.xp = 0; s.need = Math.floor(s.need * 1.6);
      s.level += 1; s.maxHp += 10; s.hp = Math.min(s.maxHp, s.hp + 20);
      s.log.push(`LEVEL ${s.level}`);
    }

    // --- next wave ---------------------------------------------------------
    if (s.zombies.length === 0 && s.scene === 'field') {
      s.wave += 1; s.gold += 5;
      if (s.wave <= this.cfg.targetLevel) { this.spawnWave(); s.log.push(`wave ${s.wave}`); }
      else { s.scene = 'cleared'; s.alive = false; s.log.push('all waves cleared'); }
    }
    if (s.wave > s.level) s.level = Math.min(this.cfg.targetLevel, s.wave);

    if (s.hp <= 0) { s.hp = 0; s.alive = false; s.log.push('overrun'); }
    if (s.log.length > 40) s.log = s.log.slice(-40);
    return s;
  }

  get finished() { return !this.state.alive; }
  get won() { return this.state.scene === 'cleared'; }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
