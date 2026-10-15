// Neon Swarm — shared types.
export type Vec2 = { x: number; z: number };

export interface Enemy {
  id: number;
  sprite: any;            // THREE.Object3D
  hp: number;
  speed: number;
  tier: number;           // 0 grunt, 1 runner, 2 brute, 3 boss
  dmg: number;
  shards: number;
}

export interface PlayerPower {
  name: string;
  level: number;
  kind: 'damage' | 'firerate' | 'speed' | 'multishot' | 'magnet' | 'regen';
}

export interface HudState {
  hp: number; maxHp: number;
  xp: number; needXp: number; level: number;
  kills: number; wave: number; elapsed: number;
  powers: PlayerPower[];
  over: boolean;
}

export type Steer = { dx: number; dy: number; say?: string };
