// Enemy AI: dumb chase (genre-correct — no pathfinding), separation so they
// don't stack, ranged kiting, explode-on-death, and leashing.

import { state } from './state.js';
import { dist, angleTo, rand } from './util.js';
import { damagePlayer } from './player.js';
import { playSfx } from './audio.js';
import { spawnEnemyProjectile, spawnParticles } from './fx.js';
import { dropLoot } from './loot.js';

const MAX_LEASH = 2200;   // ~2x viewport diagonal

export function spawnEnemy(def, x, y, hpMult = 1, speedMult = 1, mods = {}) {
  if (state.enemies.length >= state.director.maxAlive) return null;
  const e = {
    def, id: def.id, x, y, vx: 0, vy: 0,
    hp: def.stats.hp * hpMult, maxHp: def.stats.hp * hpMult,
    speed: def.stats.speed * speedMult,
    damage: def.stats.damage, xp: def.stats.xp,
    radius: def.stats.radius,
    knockbackResist: def.stats.knockbackResist ?? 0,
    rangedCd: rand(def.ranged?.cooldown ?? 0, 0),
    hurtFlash: 0, anim: 'walk', animTime: 0, alive: true,
    mods, contactCd: 0,
  };
  state.enemies.push(e);
  return e;
}

export function updateEnemies(dt) {
  const p = state.player;
  const list = state.enemies;

  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (!e.alive) { list.splice(i, 1); continue; }

    e.animTime += dt;
    if (e.hurtFlash > 0) e.hurtFlash -= dt;
    if (e.contactCd > 0) e.contactCd -= dt;

    const d = dist(e.x, e.y, p.x, p.y);
    if (d > MAX_LEASH) { list.splice(i, 1); continue; }

    const ang = angleTo(e.x, e.y, p.x, p.y);

    if (e.def.kind === 'ranged' && e.def.ranged) {
      // Kite: hold preferred distance, fire on cooldown.
      const pref = e.def.ranged.preferredDist;
      const move = d > pref + 40 ? 1 : d < pref - 40 ? -1 : 0;
      e.x += Math.cos(ang) * e.speed * move * dt;
      e.y += Math.sin(ang) * e.speed * move * dt;
      e.rangedCd -= dt;
      if (e.rangedCd <= 0 && d < e.def.ranged.range && p.alive) {
        e.rangedCd = e.def.ranged.cooldown;
        spawnEnemyProjectile(e.x, e.y, ang, e.def.ranged.projectileSpeed, e.def.ranged.damage);
      }
    } else {
      // Chase.
      e.x += Math.cos(ang) * e.speed * dt;
      e.y += Math.sin(ang) * e.speed * dt;
    }

    // Separation — cheap single pass against a few neighbours.
    const seen = Math.min(list.length, i + 6);
    for (let j = i + 1; j < seen; j++) {
      const o = list[j];
      const dd = dist(e.x, e.y, o.x, o.y);
      const min = e.radius + o.radius;
      if (dd > 0 && dd < min) {
        const push = (min - dd) * 0.5;
        const a = angleTo(o.x, o.y, e.x, e.y);
        e.x += Math.cos(a) * push; e.y += Math.sin(a) * push;
      }
    }

    // Contact damage.
    if (p.alive && d < e.radius + p.radius && e.contactCd <= 0) {
      if (damagePlayer(e.damage)) e.contactCd = 0.6;
    }
  }
}

export function hurtEnemy(e, amount, fromX, fromY, knockback = 120) {
  e.hp -= amount;
  e.hurtFlash = 0.12;
  if (e.knockbackResist < 1 && fromX !== undefined) {
    const a = angleTo(fromX, fromY, e.x, e.y);
    const k = knockback * (1 - e.knockbackResist);
    e.x += Math.cos(a) * k * 0.1;
    e.y += Math.sin(a) * k * 0.1;
  }
  if (e.hp <= 0 && e.alive) killEnemy(e, fromX, fromY);
}

export function killEnemy(e) {
  e.alive = false;
  const p = state.player;
  p.kills++;

  // Every kill pays gold. Without this the shop has nothing to spend — the
  // only income used to be a 3% coin drop.
  const greed = p.mods?.greedMult ?? 1;
  p.gold += Math.max(1, Math.round((state.goldPerKill ?? 2) * greed));
  if (e.def?.kind === 'boss') {
    p.gold += Math.round((state.goldPerBoss ?? 1200) * greed);
  }

  spawnParticles(e.x, e.y, e.def?.stats?.radius ?? 16, '#8b1a2b', 10);
  playSfx('enemyDie');

  if (e.def?.explode) {
    // Bloater: burst on death, hits player and other enemies.
    spawnParticles(e.x, e.y, e.def.explode.radius, '#ff7a3d', 28);
    playSfx('explode');
    state.shake = Math.min(16, state.shake + 8);
    const pd = dist(e.x, e.y, p.x, p.y);
    if (pd < e.def.explode.radius + p.radius) damagePlayer(e.def.explode.damage);
    for (const o of state.enemies) {
      if (o === e || !o.alive) continue;
      if (dist(e.x, e.y, o.x, o.y) < e.def.explode.radius + o.radius) {
        hurtEnemy(o, e.def.explode.damage, e.x, e.y, 200);
      }
    }
    return;
  }
  dropLoot(e);
}
