// The Colossus. Multi-phase: slam (radial AoE), summon adds, and a
// telegraphed charge. Phase changes on HP thresholds from data/enemies.json.

import { state } from './state.js';
import { ENEMIES } from './catalogs.js';
import { dist, angleTo, clamp } from './util.js';
import { damagePlayer } from './player.js';
import { spawnParticles } from './fx.js';
import { spawnEnemy } from './enemies.js';
import { playSfx } from './audio.js';

export function spawnBoss(typeId, x, y) {
  const def = ENEMIES[typeId];
  if (!def) return null;
  const b = {
    def, id: def.id, x, y, vx: 0, vy: 0,
    hp: def.stats.hp, maxHp: def.stats.hp, radius: def.stats.radius,
    speed: def.stats.speed, damage: def.stats.damage, xp: def.stats.xp,
    knockbackResist: 1, hurtFlash: 0, alive: true, isBoss: true,
    phase: 0, slamCd: 3, summonCd: 5, chargeCd: 8, chargeTime: 0,
    contactCd: 0, anim: 'walk', animTime: 0,
  };
  state.enemies.push(b);
  return b;
}

export function updateBoss(b, dt) {
  const p = state.player;
  if (!b.alive || !p.alive) return;
  if (b.hurtFlash > 0) b.hurtFlash -= dt;

  // phase resolution
  const pct = b.hp / b.maxHp;
  const phases = b.def.phases ?? [];
  let target = 0;
  for (let i = 0; i < phases.length; i++) if (pct <= phases[i].atHpPct) target = i;
  if (target !== b.phase) { b.phase = target; triggerPhase(b); }

  const ph = phases[b.phase] ?? {};
  const d = dist(b.x, b.y, p.x, p.y);

  // charge state
  if (b.chargeTime > 0) {
    b.chargeTime -= dt;
    b.x = clamp(b.x + b.cvx * dt, 60, state.arena.width - 60);
    b.y = clamp(b.y + b.cvy * dt, 60, state.arena.height - 60);
    if (d < b.radius + p.radius) damagePlayer(b.damage * 1.4);
    return;
  }

  // move toward player
  const a = angleTo(b.x, b.y, p.x, p.y);
  b.x += Math.cos(a) * b.speed * dt;
  b.y += Math.sin(a) * b.speed * dt;

  // contact
  if (b.contactCd > 0) b.contactCd -= dt;
  if (d < b.radius + p.radius && b.contactCd <= 0) {
    if (damagePlayer(b.damage)) b.contactCd = 0.8;
  }

  // slam
  if (ph.slam) {
    b.slamCd -= dt;
    if (b.slamCd <= 0 && d < 260) {
      b.slamCd = ph.slam.cooldown;
      spawnParticles(b.x, b.y, ph.slam.radius, '#ff7a3d', 36);
      playSfx('bossSlam');
      state.shake = 20;
      if (d < ph.slam.radius + p.radius) damagePlayer(ph.slam.damage);
    }
  }
  // summon
  if (ph.summon) {
    b.summonCd -= dt;
    if (b.summonCd <= 0) {
      b.summonCd = ph.summon.cooldown;
      const def = ENEMIES[ph.summon.id];
      if (def) {
        for (let i = 0; i < ph.summon.count; i++) {
          const ang = (i / ph.summon.count) * Math.PI * 2;
          spawnEnemy(def, b.x + Math.cos(ang) * 120, b.y + Math.sin(ang) * 120, 1, 1, null);
        }
      }
    }
  }
  // charge
  if (ph.charge) {
    b.chargeCd -= dt;
    if (b.chargeCd <= 0 && d > 180) {
      b.chargeCd = ph.charge.cooldown;
      b.chargeTime = 0.55;
      b.cvx = Math.cos(a) * ph.charge.speed;
      b.cvy = Math.sin(a) * ph.charge.speed;
      playSfx('bossSlam');
    }
  }
}

function triggerPhase(b) {
  state.shake = 24;
  spawnParticles(b.x, b.y, b.radius * 2, '#b26bff', 48);
  playSfx('explode');
}
