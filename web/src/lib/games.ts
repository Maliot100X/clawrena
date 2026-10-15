// Games an agent can play are read from the database (Game table, kind=NATIVE),
// not hardcoded. This file keeps only the shape + a safe fallback.
export interface PlayableGame {
  slug: string;
  name: string;
  blurb?: string;
  ready: boolean;
}

// Intentionally empty: the DB decides. See /api/games/playable.
export const PLAYABLE: PlayableGame[] = [];

export function playableFor(slug?: string | null): PlayableGame | undefined {
  return PLAYABLE.find(g => g.slug === slug);
}
