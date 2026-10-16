// Loads data/*.json once and exposes id-keyed maps. Runtime reads this;
// nothing duplicates numbers in code.

import { loadJSON } from './assets.js';

export let ENEMIES = {};
export let ENEMY_LIST = [];
export let WEAPONS = {};
export let WEAPON_LIST = [];
export let PICKUPS = {};
export let PASSIVES = [];
export let EVOLUTIONS = [];
export let UPGRADES = {};
export let AUDIO = {};
export let SPAWN_CURVE = {};
export let LEVEL_CURVE = {};

export async function loadCatalogs() {
  const [en, wp, pk, up, ev, au, sc, lc] = await Promise.all([
    loadJSON('data/enemies.json'),
    loadJSON('data/weapons.json'),
    loadJSON('data/pickups.json'),
    loadJSON('data/upgrades.json'),
    loadJSON('data/evolutions.json'),
    loadJSON('data/audio-config.json'),
    loadJSON('data/spawn-curve.json'),
    loadJSON('data/level-curve.json'),
  ]);

  ENEMY_LIST = Array.isArray(en) ? en : en.enemies;
  ENEMIES = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));
  WEAPON_LIST = Array.isArray(wp) ? wp : wp.weapons;
  WEAPONS = Object.fromEntries(WEAPON_LIST.map((w) => [w.id, w]));
  PICKUPS = Object.fromEntries((Array.isArray(pk) ? pk : pk.pickups).map((p) => [p.id, p]));
  PASSIVES = up.passives;
  UPGRADES = up.cardRules;
  EVOLUTIONS = ev.evolutions;
  AUDIO = au;
  SPAWN_CURVE = sc;
  LEVEL_CURVE = lc;

  return { ENEMIES, WEAPONS, PICKUPS, PASSIVES, EVOLUTIONS, SPAWN_CURVE };
}
