// ClawRena native game: deterministic seeded deckbuilder.
// Built from the card-game genre skill: card data, deck/hand/discard zones,
// draw with automatic reshuffle, a turn structure, costs, effect resolution.
// The agent plays one card per tick, choosing by bias (dx picks the card).
import type { BaseGameState, GameConfig, GameEngine } from './types.js';

export interface Card { id: number; name: string; cost: number; dmg: number; block: number; }

export interface CardState extends BaseGameState {
  turn: number; energy: number; maxEnergy: number;
  draw: number[]; hand: number[]; discard: number[];
  enemyHp: number; enemyMax: number; block: number;
  library: Card[];
}

function makeLibrary(): Card[] {
  const L: Card[] = [];
  for (let i = 0; i < 5; i++) L.push({ id: i, name: 'Strike', cost: 1, dmg: 6, block: 0 });
  for (let i = 5; i < 9; i++) L.push({ id: i, name: 'Guard', cost: 1, dmg: 0, block: 5 });
  for (let i = 9; i < 11; i++) L.push({ id: i, name: 'Cleave', cost: 2, dmg: 11, block: 0 });
  return L;
}

export class CardGame implements GameEngine<CardState> {
  state: CardState;
  cfg: GameConfig;
  private rng: () => number;

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.rng = mulberry32(cfg.seed);
    const library = makeLibrary();
    const draw = library.map(c => c.id);
    this.shuffle(draw);
    this.state = {
      tick: 0, level: 1, hp: 40, maxHp: 40, kills: 0, gold: 0, elapsedMs: 0, alive: true,
      turn: 1, energy: 3, maxEnergy: 3, draw, hand: [], discard: [],
      enemyHp: 30, enemyMax: 30, block: 0, library, log: ['a foe blocks the path'],
    };
    this.drawUp(5);
  }

  /** Fisher-Yates with the seeded RNG — deterministic per run. */
  private shuffle(a: number[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  /** draw n, reshuffling the discard into the draw pile when it runs dry. */
  private drawUp(n: number) {
    const s = this.state;
    for (let i = 0; i < n; i++) {
      if (s.draw.length === 0) {
        if (s.discard.length === 0) break;
        s.draw = s.discard.slice(); s.discard = [];
        this.shuffle(s.draw);
        s.log.push('reshuffled');
      }
      s.hand.push(s.draw.pop()!);
    }
  }

  private card(id: number) { return this.state.library.find(c => c.id === id)!; }

  step(bias: { dx: number; dy: number } = { dx: 0, dy: 0 }) {
    const s = this.state;
    if (!s.alive) return s;
    s.tick += 1; s.elapsedMs += 250;

    // --- play a card. A passive agent (dx=0) must still take a turn, or the
    // turn never ends and the duel can never resolve. bias.dx picks the index
    // when provided; otherwise we play the first affordable card.
    if (s.hand.length) {
      const idx = bias.dx
        ? Math.min(s.hand.length - 1, Math.abs(Math.sign(bias.dx) + (bias.dx > 0 ? 0 : s.hand.length - 1)))
        : s.hand.findIndex(id => this.card(id).cost <= s.energy);
      if (idx >= 0) {
        const c = this.card(s.hand[idx]);
        if (c && c.cost <= s.energy) {
          s.energy -= c.cost;
          s.enemyHp -= c.dmg;
          s.block += c.block;
          s.hand.splice(idx, 1);
          s.discard.push(c.id);
          s.log.push(`played ${c.name}${c.dmg ? ` (-${c.dmg} enemy)` : ` (+${c.block} block)`}`);
        }
      }
    }

    // --- end turn: enemy acts, then refresh --------------------------------
    if (s.energy === 0 || s.hand.length === 0) {
      const dmg = 5 + Math.floor(this.rng() * 4);
      const taken = Math.max(0, dmg - s.block);
      s.hp -= taken; s.block = 0;
      s.log.push(`enemy hits for ${taken} (hp ${Math.max(0, s.hp)})`);

      s.turn += 1;
      const lvl = Math.min(this.cfg.targetLevel, 1 + Math.floor(s.turn / 3));
      if (lvl > s.level) { s.level = lvl; }

      s.energy = s.maxEnergy;
      this.drawUp(5 - s.hand.length);

      // enemy defeated -> a stronger one, until the target depth
      if (s.enemyHp <= 0) {
        s.kills += 1; s.gold += 20;
        const newLevel = Math.min(this.cfg.targetLevel, s.kills + 1);
        s.enemyMax = 30 + s.kills * 12;
        s.enemyHp = s.enemyMax;
        s.hp = Math.min(s.maxHp, s.hp + 8);
        s.log.push(`foe slain — a tougher one appears`);
        if (newLevel > s.level) s.level = newLevel;
        if (s.kills >= this.cfg.targetLevel) { s.alive = false; s.log.push('dungeon cleared'); }
      }
    }

    if (s.hp <= 0) { s.hp = 0; s.alive = false; s.log.push('you fell'); }
    if (s.log.length > 40) s.log = s.log.slice(-40);
    return s;
  }

  get finished() { return !this.state.alive; }
  get won() { return this.state.kills >= this.cfg.targetLevel; }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
