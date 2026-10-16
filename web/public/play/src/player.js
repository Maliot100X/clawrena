// Player controller: 8-way move, dash with i-frames, contact damage,
// animation selection. Auto-attack is NOT here — that's weapons.js.

import { state } from './state.js';
import { clamp, dist, xpForLevel } from './util.js';
import { playSfx } from './audio.js';

const DASH_SPEED = 520;
const DASH_TIME = 0.16;
const DASH_COOLDOWN = 3.0;
const IFRAME_ON_HIT = 1.0;

export function updatePlayer(dt, input) {
  const p = state.player;
  if (!p.alive) return;

  p.animTime += dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  // --- dash ---
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.x = clamp(p.x + p.dashVx * dt, 40, state.arena.width - 40);
    p.y = clamp(p.y + p.dashVy * dt, 40, state.arena.height - 40);
    p.anim = 'walk';
    return;
  }
  if (input.dashPressed && p.dashCd <= 0) {
    let dx = input.ax, dy = input.ay;
    if (dx === 0 && dy === 0) { dx = p.facing; dy = 0; }
    const len = Math.hypot(dx, dy) || 1;
    p.dashVx = (dx / len) * DASH_SPEED;
    p.dashVy = (dy / len) * DASH_SPEED;
    p.dashTime = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
    p.invuln = DASH_TIME + 0.12;
    playSfx('dash');
    return;
  }

  // --- movement ---
  const len = Math.hypot(input.ax, input.ay);
  if (len > 0) {
    const nx = input.ax / len, ny = input.ay / len;
    p.x = clamp(p.x + nx * p.speed * dt, 40, state.arena.width - 40);
    p.y = clamp(p.y + ny * p.speed * dt, 40, state.arena.height - 40);
    if (nx !== 0) p.facing = nx > 0 ? 1 : -1;
    p.anim = 'walk';
  } else {
    p.anim = 'idle';
  }
}

export function damagePlayer(amount) {
  const p = state.player;
  if (!p.alive || p.invuln > 0) return false;
  const dealt = Math.max(1, amount - p.armor);
  p.hp -= dealt;
  p.invuln = IFRAME_ON_HIT;
  p.anim = 'hurt';
  state.shake = Math.min(14, state.shake + 7);
  playSfx('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    p.anim = 'death';
  }
  return true;
}

export function healPlayer(amount) {
  const p = state.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

export function grantXp(amount) {
  const p = state.player;
  p.xp += amount * (p.mods.xpMult ?? 1);
  let leveled = 0;
  while (p.xp >= p.xpNext && p.level < 60) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpForLevel(p.level);
    leveled++;
  }
  return leveled;
}

export function playerLevel() { return state.player.level; }
