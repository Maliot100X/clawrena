// Projectiles, particles, screen fx. Pools where it matters.

import { state } from './state.js';
import { dist, angleTo, rand, dist2 } from './util.js';
import { hurtEnemy } from './enemies.js';
import { damagePlayer } from './player.js';
import { playSfx } from './audio.js';

export function spawnPlayerProjectile(x, y, angle, speed, damage, opts = {}) {
  state.projectiles.push({
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    damage, radius: opts.radius ?? 7, pierce: opts.pierce ?? 1,
    sprite: opts.sprite ?? 'soul_bolt', homing: opts.homing ?? 0,
    life: 2.2, alive: true, hit: new Set(),
  });
}

export function spawnEnemyProjectile(x, y, angle, speed, damage) {
  state.enemyProjectiles.push({
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    damage, radius: 8, life: 4, alive: true,
  });
}

export function spawnParticles(x, y, radius, color, count) {
  for (let i = 0; i < count; i++) {
    const a = rand(Math.PI * 2), sp = rand(160, 40);
    state.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.5, 0.2), maxLife: 0.5, color,
      size: rand(4, 1.5), alive: true,
    });
  }
}

export function updateProjectiles(dt) {
  const p = state.player;

  // player projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const b = state.projectiles[i];
    if (!b.alive) { state.projectiles.splice(i, 1); continue; }
    b.life -= dt;
    if (b.life <= 0) { b.alive = false; continue; }

    if (b.homing > 0) {
      let best = null, bd = 1e9;
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const d = dist2(b.x, b.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const want = angleTo(b.x, b.y, best.x, best.y);
        const cur = Math.atan2(b.vy, b.vx);
        let da = want - cur;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const sp = Math.hypot(b.vx, b.vy);
        const na = cur + Math.max(-b.homing * dt, Math.min(b.homing * dt, da));
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;

    for (const e of state.enemies) {
      if (!e.alive || b.hit.has(e)) continue;
      if (dist(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
        b.hit.add(e);
        hurtEnemy(e, b.damage, b.x, b.y, 120);
        if (b.hit.size >= b.pierce) { b.alive = false; break; }
      }
    }
  }

  // enemy projectiles
  for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
    const b = state.enemyProjectiles[i];
    if (!b.alive) { state.enemyProjectiles.splice(i, 1); continue; }
    b.life -= dt;
    if (b.life <= 0) { b.alive = false; continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (p.alive && dist(b.x, b.y, p.x, p.y) < b.radius + p.radius) {
      damagePlayer(b.damage);
      b.alive = false;
    }
  }
}

export function updateMines(dt) {
  for (let i = state.mines.length - 1; i >= 0; i--) {
    const m = state.mines[i];
    if (!m.alive) { state.mines.splice(i, 1); continue; }
    m.arm -= dt; m.life -= dt;
    if (m.life <= 0) { m.alive = false; continue; }
    if (m.arm > 0) continue;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist(m.x, m.y, e.x, e.y) < m.radius + e.radius) {
        spawnParticles(m.x, m.y, m.radius, '#ff7a3d', 20);
        playSfx('explode');
        state.shake = Math.min(14, state.shake + 6);
        for (const o of state.enemies) {
          if (o.alive && dist(m.x, m.y, o.x, o.y) < m.radius + o.radius)
            hurtEnemy(o, m.damage, m.x, m.y, 200);
        }
        m.alive = false;
        break;
      }
    }
  }
}

export function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const q = state.particles[i];
    q.life -= dt;
    if (q.life <= 0) { state.particles.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.92; q.vy *= 0.92;
  }
}

export function updateShake(dt) {
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
}
