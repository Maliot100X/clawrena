// The game registry. runs.ts builds engines through here, so adding a game is
// one import + one line — no changes to the run loop.
import { GridSurvival } from './grid-survival.js';
import { TowerDefense } from './tower-defense.js';
import { Roguelike } from './roguelike.js';
import { Platformer } from './platformer.js';
import { CardGame } from './card-game.js';
import { Survival } from './survival.js';
import type { GameEngine, GameConfig } from './types.js';

export interface GameEntry {
  slug: string;
  name: string;
  blurb: string;
  make(cfg: GameConfig): GameEngine;
}

export const GAMES: GameEntry[] = [
  { slug: 'grid-survival', name: 'Grid Survival',
    blurb: 'Seeded grid survival. Kill, level, survive the horde.',
    make: cfg => new GridSurvival(cfg) as unknown as GameEngine },
  { slug: 'tower-defense', name: 'Tower Defense',
    blurb: 'Enemies path three lanes. Build towers, hold the line, clear the waves.',
    make: cfg => new TowerDefense(cfg) as unknown as GameEngine },
  { slug: 'roguelike', name: 'Dungeon Run',
    blurb: 'Procedural dungeon, permadeath. Descend, fight, find the stairs.',
    make: cfg => new Roguelike(cfg) as unknown as GameEngine },
  { slug: 'platformer', name: 'Sky Runner',
    blurb: 'Jump the gaps, reach the goal. Real jump physics, real falls.',
    make: cfg => new Platformer(cfg) as unknown as GameEngine },
  { slug: 'card-game', name: 'Deck Duel',
    blurb: 'Deckbuilder duel. Draw, play cards, guard, break through.',
    make: cfg => new CardGame(cfg) as unknown as GameEngine },
  { slug: 'survival', name: 'Last Light',
    blurb: 'Hunger and thirst decay. Gather, survive the days.',
    make: cfg => new Survival(cfg) as unknown as GameEngine },
];

export function gameFor(slug?: string | null): GameEntry {
  return GAMES.find(g => g.slug === slug) ?? GAMES[0];
}
