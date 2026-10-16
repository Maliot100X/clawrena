// Shared mutable game state. One object, imported everywhere.
// Data (numbers) still lives in data/*.json — this holds runtime instances.

export const state = {
  // scene control
  scene: 'title',        // title | playing | levelup | results | win | boss
  paused: false,

  // time
  now: 0, dt: 0, elapsed: 0,

  // camera
  camera: { x: 0, y: 0, w: 1280, h: 720 },

  // arena
  arena: { width: 3000, height: 3000, wrap: false },
  props: [],
  levelId: 'blood_arena',
  background: null,
  level: null,

  // player
  player: {
    x: 1500, y: 1500, vx: 0, vy: 0, facing: 1,
    hp: 100, maxHp: 100, baseSpeed: 130, speed: 130,
    radius: 16, magnetRadius: 150,
    armor: 0, regen: 0,
    invuln: 0, dashCd: 0, dashTime: 0,
    level: 1, xp: 0, xpNext: 10,
    kills: 0, gold: 0,
    alive: true, anim: 'idle', animTime: 0,
    mods: {
      damageMult: 1, speedMult: 1, cooldownMult: 1, areaMult: 1,
      magnetMult: 1, xpMult: 1, luckAdd: 0, maxHpAdd: 0, armorAdd: 0, regenAdd: 0,
    },
    weapons: [],          // [{ id, level, cd, evolved }]
    passives: {},         // id -> level
    relic: null,
  },

  // entity pools / arrays
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  pickups: [],
  particles: [],
  mines: [],
  orbits: [],

  // director
  director: null,

  // levelup
  levelupChoices: [],

  // results
  results: null,

  // fx
  shake: 0, hitstop: 0,
  autopilot: false,
  showSettings: false,
  showShop: false,
  shopTab: 'chars',
  shopData: null,
  shopNotice: null,
  strategy: 'survivor',

  // meta (localStorage-backed)
  meta: { bestTime: 0, bestKills: 0, runs: 0, unlockedChars: ['hunter'] },
};

export function resetRun(level) {
  const p = state.player;
  Object.assign(state, {
    elapsed: 0, enemies: [], projectiles: [], enemyProjectiles: [],
    pickups: [], particles: [], mines: [], orbits: [], shake: 0, hitstop: 0,
    levelupChoices: [], results: null,
  });
  Object.assign(p, {
    x: level?.playerSpawn?.x ?? 1500, y: level?.playerSpawn?.y ?? 1500,
    vx: 0, vy: 0, hp: 100, maxHp: 100, speed: p.baseSpeed, armor: 0, regen: 0,
    invuln: 0, dashCd: 0, dashTime: 0, level: 1, xp: 0, xpNext: 10,
    kills: 0, gold: 0, alive: true, anim: 'idle', animTime: 0, relic: null,
    weapons: [{ id: 'soul_bolt', level: 1, cd: 0, evolved: false }],
    passives: {},
    mods: { damageMult: 1, speedMult: 1, cooldownMult: 1, areaMult: 1,
            magnetMult: 1, xpMult: 1, luckAdd: 0, maxHpAdd: 0, armorAdd: 0, regenAdd: 0 },
  });

  // Apply the equipped hero's modifiers, and any shop upgrades the player owns.
  // Without this, buying a character in the shop would change nothing in play.
  const heroMods = state.activeHeroMods ?? {};
  applyMods(p, heroMods);
  for (const id of state.meta?.ownedUpgrades ?? []) {
    const up = (state.shopData?.upgrades ?? []).find((u) => u.id === id);
    if (up) applyMods(p, up.mods ?? {});
  }
  if (p.mods.maxHpAdd) { p.maxHp = 100 + p.mods.maxHpAdd; p.hp = p.maxHp; }
  if (p.mods.speedMult !== 1) p.speed = p.baseSpeed * p.mods.speedMult;
  if (p.mods.armorAdd) p.armor = p.mods.armorAdd;
  if (p.mods.regenAdd) p.regen = p.mods.regenAdd;
}

/** Fold a shop/hero mod block into the player's live modifiers. */
function applyMods(p, m) {
  if (!m) return;
  const M = p.mods;
  if (m.damageMult) M.damageMult += m.damageMult;
  if (m.speedMult) M.speedMult += m.speedMult;
  if (m.cooldownMult) M.cooldownMult = Math.max(0.35, M.cooldownMult + m.cooldownMult);
  if (m.areaMult) M.areaMult += m.areaMult;
  if (m.magnetMult) M.magnetMult += m.magnetMult;
  if (m.xpMult) M.xpMult += m.xpMult;
  if (m.luckAdd) M.luckAdd += m.luckAdd;
  if (m.maxHpAdd) M.maxHpAdd += m.maxHpAdd;
  if (m.armorAdd) M.armorAdd += m.armorAdd;
  if (m.regenAdd) M.regenAdd += m.regenAdd;
  if (m.critChanceAdd) M.critChance = (M.critChance ?? 0) + m.critChanceAdd;
  if (m.critMultAdd) M.critMult = (M.critMult ?? 1.5) + m.critMultAdd;
  if (m.dashCdMult) M.dashCdMult = Math.max(0.4, (M.dashCdMult ?? 1) + m.dashCdMult);
  if (m.thornsAdd) M.thorns = (M.thorns ?? 0) + m.thornsAdd;
  if (m.pierceAdd) M.pierce = (M.pierce ?? 0) + m.pierceAdd;
  if (m.revivesAdd) M.revives = (M.revives ?? 0) + m.revivesAdd;
  if (m.greedMult) M.greedMult = (M.greedMult ?? 1) + m.greedMult;
  if (m.projSpeedMult) M.projSpeedMult = (M.projSpeedMult ?? 1) + m.projSpeedMult;
}
