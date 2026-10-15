// Neon Swarm — XP, levels, and the power-up pool. Built from the roguelike /
// survival genre skills: weighted rolls, stacking levels, visible effects.
import type { PlayerPower } from './types';

export const POWER_POOL: Omit<PlayerPower, 'level'>[] = [
  { name: 'Overclock',  kind: 'damage' },
  { name: 'Rapid Fire', kind: 'firerate' },
  { name: 'Thrusters',  kind: 'speed' },
  { name: 'Split Shot', kind: 'multishot' },
  { name: 'Magnet',     kind: 'magnet' },
  { name: 'Nanorepair', kind: 'regen' },
];

export function xpNeed(level: number): number {
  return Math.floor(5 * Math.pow(1.5, level - 1));
}

/** Pick `n` distinct upgrade options, favouring ones the player already has. */
export function rollUpgrades(owned: PlayerPower[], n = 3, rng = Math.random): PlayerPower[] {
  const pool = [...POWER_POOL];
  const picks: PlayerPower[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const base = pool.splice(idx, 1)[0];
    const have = owned.find(p => p.kind === base.kind);
    picks.push({ ...base, level: (have?.level ?? 0) + 1 });
  }
  return picks;
}

/** Apply a picked power to the player's stat block. */
export function applyPower(stats: any, power: PlayerPower) {
  switch (power.kind) {
    case 'damage':    stats.damage += 2; break;
    case 'firerate':  stats.fireMs = Math.max(70, stats.fireMs * 0.82); break;
    case 'speed':     stats.speed += 1.2; break;
    case 'multishot': stats.shots += 1; break;
    case 'magnet':    stats.magnet += 6; break;
    case 'regen':     stats.regen += 1.2; break;
  }
}

export function defaultStats() {
  return { damage: 4, fireMs: 320, speed: 9, shots: 1, magnet: 8, regen: 0, range: 26 };
}
