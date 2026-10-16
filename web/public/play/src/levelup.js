// Level-up: pause, offer 3 cards, apply the choice. Also handles weapon
// evolution (weapon at L3 + matching passive at L3 -> evolved form).

import { state } from './state.js';
import { PASSIVES, WEAPONS, UPGRADES, EVOLUTIONS } from './catalogs.js';
import { shuffle } from './util.js';
import { playSfx } from './audio.js';

export function buildChoices() {
  const p = state.player;
  const pool = [];

  // weapon upgrades / new weapons
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (w.level < (def?.levels?.length ?? 5)) {
      pool.push({ kind: 'weapon', id: w.id, name: def.name, desc: `Lv${w.level + 1}`, weight: UPGRADES.weaponCardWeight ?? 1.4 });
    }
  }
  // Weapons available for a NEW slot. Purchased shop weapons are guaranteed to
  // appear; the rest are the defaults.
  const boughtIds = new Set(
    (state.meta?.ownedWeapons ?? [])
      .map((id) => (state.shopData?.weapons ?? []).find((w) => w.id === id)?.weaponId)
      .filter(Boolean)
  );
  if (p.weapons.length < 4) {
    for (const def of Object.values(WEAPONS)) {
      if (p.weapons.some((w) => w.id === def.id)) continue;
      const isBought = boughtIds.has(def.id);
      pool.push({ kind: 'newWeapon', id: def.id, name: def.name, desc: def.desc,
                  weight: (UPGRADES.newWeaponWeight ?? 1.0) * (isBought ? 3 : 1) });
    }
  }

  // passives
  for (const pas of PASSIVES) {
    const lvl = p.passives[pas.id] ?? 0;
    if (lvl < pas.maxLevel) {
      pool.push({ kind: 'passive', id: pas.id, name: pas.name, desc: pas.desc, weight: 1.0 });
    }
  }

  // evolutions take priority when satisfied
  for (const ev of EVOLUTIONS) {
    const w = p.weapons.find((x) => x.id === ev.weapon);
    if (!w || w.evolved) continue;
    if (w.level >= 3 && (p.passives[ev.requiresPassive] ?? 0) >= ev.passiveLevel) {
      pool.push({ kind: 'evolve', id: ev.weapon, name: ev.evolvedName, desc: ev.desc, weight: 6.0 });
    }
  }

  const weighted = [];
  for (const c of pool) for (let i = 0; i < Math.max(1, Math.round(c.weight * 10)); i++) weighted.push(c);
  const seen = new Set();
  const out = [];
  for (const c of shuffle(weighted)) {
    const key = c.kind + ':' + c.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= (UPGRADES.cardsPerLevelUp ?? 3)) break;
  }
  while (out.length < 3) out.push({ kind: 'heal', id: 'heal', name: 'Blood Draught', desc: 'Restore 30 HP' });
  return out;
}

export function applyChoice(choice) {
  const p = state.player;
  playSfx('levelUp');
  switch (choice.kind) {
    case 'weapon': {
      const w = p.weapons.find((x) => x.id === choice.id);
      if (w) w.level++;
      break;
    }
    case 'newWeapon':
      p.weapons.push({ id: choice.id, level: 1, cd: 0, evolved: false });
      break;
    case 'passive': {
      const lvl = (p.passives[choice.id] ?? 0) + 1;
      p.passives[choice.id] = lvl;
      applyPassive(choice.id, lvl);
      break;
    }
    case 'evolve': {
      const w = p.weapons.find((x) => x.id === choice.id);
      if (w) { w.evolved = true; w.level = Math.max(w.level, 5); }
      break;
    }
    case 'heal':
      p.hp = Math.min(p.maxHp, p.hp + 30);
      break;
  }
}

function applyPassive(id, level) {
  const p = state.player;
  const pas = PASSIVES.find((x) => x.id === id);
  if (!pas) return;
  const m = pas.mods ?? {};
  if (m.damageMult) p.mods.damageMult = 1 + m.damageMult * level;
  if (m.speedMult) {
    p.mods.speedMult = 1 + m.speedMult * level;
    p.speed = p.baseSpeed * p.mods.speedMult;
  }
  if (m.cooldownMult) p.mods.cooldownMult = Math.max(0.35, 1 + m.cooldownMult * level);
  if (m.areaMult) p.mods.areaMult = 1 + m.areaMult * level;
  if (m.magnetMult) p.mods.magnetMult = 1 + m.magnetMult * level;
  if (m.xpMult) p.mods.xpMult = 1 + m.xpMult * level;
  if (m.luckAdd) p.mods.luckAdd = m.luckAdd * level;
  if (m.regenAdd) p.regen = m.regenAdd * level;
  if (m.armorAdd) p.armor = m.armorAdd * level;
  if (m.maxHpAdd) {
    const add = m.maxHpAdd * level;
    p.maxHp = 100 + add;
    p.hp = Math.min(p.maxHp, p.hp + m.maxHpAdd);
  }
  // Extended passives — crit / defence / mobility / economy.
  if (m.critChanceAdd) p.mods.critChance = m.critChanceAdd * level;
  if (m.critMultAdd) p.mods.critMult = 1.5 + m.critMultAdd * level;
  if (m.dashCdMult) p.mods.dashCdMult = Math.max(0.4, 1 + m.dashCdMult * level);
  if (m.thornsAdd) p.mods.thorns = m.thornsAdd * level;
  if (m.projSpeedMult) p.mods.projSpeedMult = 1 + m.projSpeedMult * level;
  if (m.pierceAdd) p.mods.pierce = m.pierceAdd * level;
  if (m.revivesAdd) p.mods.revives = m.revivesAdd * level;
  if (m.greedMult) p.mods.greedMult = 1 + m.greedMult * level;
}

export function maybeLevelUp() {
  const p = state.player;
  if ((p.pendingLevels ?? 0) > 0 && state.scene === 'playing') {
    p.pendingLevels--;
    state.levelupChoices = buildChoices();
    state.scene = 'levelup';
    state.paused = true;
    state.levelupShownMs = 0;   // start the player-first grace window
    return true;
  }
  return false;
}
