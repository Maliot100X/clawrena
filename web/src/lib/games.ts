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
];

export function playableFor(slug?: string | null) {
  return PLAYABLE.find(g => g.slug === slug) ?? PLAYABLE[0];
}
