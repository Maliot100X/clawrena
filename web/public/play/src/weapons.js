// Auto-fire weapon timers. Player never aims — each weapon picks its target
// by pattern. closestEnemy is cached per weapon and refreshed ~0.2s, not
// every frame (quadratic with 300 enemies).

import { state } from './state.js';
import { WEAPONS, EVOLUTIONS } from './catalogs.js';
import { dist, dist2, angleTo, rand } from './util.js';
import { hurtEnemy } from './enemies.js';
import { spawnPlayerProjectile, spawnParticles } from './fx.js';
import { playSfx } from './audio.js';

function findClosest(x, y, maxR = 1e9) {
  let best = null, bd = maxR * maxR;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function updateWeapons(dt) {
  const p = state.player;
  if (!p.alive) return;

  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (!def) continue;
    const lv = def.levels[Math.min(w.level, def.levels.length) - 1];

    // Orbit weapons run continuously — no cooldown gate.
    if (def.kind === 'orbit') { updateOrbits(dt, w, def, lv); continue; }

    w.cd -= dt;
    if (w.cd > 0) continue;
    w.cd = (lv.cooldown ?? 1) * (p.mods.cooldownMult ?? 1);

    switch (def.kind) {
      case 'forward': fireForward(w, def, lv); break;
      case 'ring':    fireRing(w, def, lv); break;
      case 'area':    fireArea(w, def, lv); break;
      case 'homing':  fireHoming(w, def, lv); break;
      case 'drop':    fireDrop(w, def, lv); break;
    }
  }
}

function evolvedBonus(w) {
  if (!w.evolved) return null;
  const ev = EVOLUTIONS.find((e) => e.weapon === w.id);
  return ev?.bonus ?? null;
}

function dmg(w, lv) {
  const p = state.player;
  return (lv.damage ?? 0) * (p.mods.damageMult ?? 1) * (evolvedBonus(w)?.damageMult ?? 1);
}
function area(w) {
  return state.player.mods.areaMult ?? 1 * (evolvedBonus(w)?.radiusMult ?? 1);
}

function fireForward(w, def, lv) {
  const p = state.player;
  const target = findClosest(p.x, p.y, 700);
  const base = target ? angleTo(p.x, p.y, target.x, target.y) : (p.facing > 0 ? 0 : Math.PI);
  const ev = evolvedBonus(w);
  const n = (ev?.projectiles ?? lv.projectiles) || 1;
  const spread = n > 1 ? 0.18 : 0;
  for (let i = 0; i < n; i++) {
    const a = base + (i - (n - 1) / 2) * spread;
    spawnPlayerProjectile(p.x, p.y, a, lv.speed ?? 380, dmg(w, lv), {
      pierce: ev?.pierce ?? lv.pierce ?? 1, sprite: 'soul_bolt', radius: 7,
    });
  }
  playSfx('shoot');
}

function fireRing(w, def, lv) {
  const p = state.player;
  const ev = evolvedBonus(w);
  const n = ev?.projectiles ?? lv.projectiles;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    spawnPlayerProjectile(p.x, p.y, a, lv.speed ?? 260, dmg(w, lv), {
      pierce: 1, sprite: 'ember_ring', radius: 7,
    });
  }
  playSfx('shoot');
}

function fireArea(w, def, lv) {
  const p = state.player;
  const ev = evolvedBonus(w);
  const R = (lv.radius ?? 96) * (ev?.radiusMult ?? 1) * (p.mods.areaMult ?? 1);
  spawnParticles(p.x, p.y, R, '#b26bff', 18);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(p.x, p.y, e.x, e.y) < R + e.radius) {
      hurtEnemy(e, dmg(w, lv), p.x, p.y, 180);
    }
  }
  playSfx('hit');
}

function fireHoming(w, def, lv) {
  const p = state.player;
  const n = lv.projectiles || 1;
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 2);
    spawnPlayerProjectile(p.x, p.y, a, lv.speed ?? 220, dmg(w, lv), {
      pierce: 1, sprite: 'hex_beam', radius: 8, homing: lv.turn ?? 4,
    });
  }
  playSfx('shoot');
}

function fireDrop(w, def, lv) {
  const p = state.player;
  const n = lv.count || 2;
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 2), r = rand(70);
    state.mines.push({
      x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r,
      radius: lv.radius ?? 72, damage: dmg(w, lv),
      arm: lv.armTime ?? 0.5, life: 8, alive: true,
    });
  }
}

function updateOrbits(dt, w, def, lv) {
  const p = state.player;
  const ev = evolvedBonus(w);
  const count = ev?.count ?? lv.count;
  const radius = (lv.radius ?? 78) * (ev?.radiusMult ?? 1) * (p.mods.areaMult ?? 1);
  w.orbAngle = (w.orbAngle ?? 0) + (lv.rotSpeed ?? 2.4) * dt;
  state.orbits = state.orbits.filter((o) => o.weapon === w.id);
  for (let i = 0; i < count; i++) {
    const a = w.orbAngle + (i / count) * Math.PI * 2;
    const ox = p.x + Math.cos(a) * radius;
    const oy = p.y + Math.sin(a) * radius;
    state.orbits.push({ weapon: w.id, x: ox, y: oy, radius: 14 });
    for (const e of state.enemies) {
      if (!e.alive || e.orbCd > 0) continue;
      if (dist(ox, oy, e.x, e.y) < 14 + e.radius) {
        hurtEnemy(e, lv.damage * (p.mods.damageMult ?? 1), ox, oy, 90);
        e.orbCd = lv.tickEvery ?? 0.4;
      }
    }
  }
}

export function tickEnemyCooldowns(dt) {
  for (const e of state.enemies) if (e.orbCd > 0) e.orbCd -= dt;
}

export { findClosest };
