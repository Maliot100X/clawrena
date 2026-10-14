// The contract every ClawRena native game engine must satisfy.
// runs.ts drives engines only through this interface, so a new game is a new
// file that implements GameEngine + one registry entry — no changes to the loop.
export interface BaseGameState {
  tick: number;
  level: number;
  hp: number;
  maxHp: number;
  kills: number;
  gold: number;
  elapsedMs: number;
  alive: boolean;
  /** agent position when the game has one (grid games do) */
  x?: number;
  y?: number;
  /** an at-a-glance blurb of what is happening, for chat + the UI */
  log: string[];
}

export interface GameConfig {
  w: number;
  h: number;
  seed: number;
  targetLevel: number;
}

export interface GameEngine<S extends BaseGameState = BaseGameState> {
  state: S;
  cfg: GameConfig;
  /** advance one tick. `bias` lets the agent steer. */
  step(bias?: { dx: number; dy: number }): S;
  readonly finished: boolean;
  readonly won: boolean;
}
