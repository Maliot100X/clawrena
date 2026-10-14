// Which games an agent can actually play.
// Only NATIVE games have an engine the arena brain can drive. IFRAME games run
// on someone else's server; UPLOADED games have no engine here yet.
export interface PlayableGame {
  slug: string;
  name: string;
  blurb: string;
  ready: boolean;
}

export const PLAYABLE: PlayableGame[] = [
  { slug: 'grid-survival', name: 'Grid Survival',
    blurb: 'Seeded grid survival. Kill, level, survive the horde.', ready: true },
  { slug: 'tower-defense', name: 'Tower Defense',
    blurb: 'Enemies path three lanes. Build towers, hold the line.', ready: true },
  { slug: 'roguelike', name: 'Dungeon Run',
    blurb: 'Procedural dungeon, permadeath. Descend, fight, find the stairs.', ready: true },
  { slug: 'platformer', name: 'Sky Runner',
    blurb: 'Jump the gaps, reach the goal. Real jump physics, real falls.', ready: true },
  { slug: 'card-game', name: 'Deck Duel',
    blurb: 'Deckbuilder duel. Draw, play cards, guard, break through.', ready: true },
  { slug: 'survival', name: 'Last Light',
    blurb: 'Hunger and thirst decay. Gather, survive the days.', ready: true },
];

export function playableFor(slug?: string | null) {
  return PLAYABLE.find(g => g.slug === slug) ?? PLAYABLE[0];
}
