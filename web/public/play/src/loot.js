// Drop table + pickup collection (magnet radius, effects).

import { state } from './state.js';
import { PICKUPS } from './catalogs.js';
import { dist, rand } from './util.js';
import { grantXp, healPlayer } from './player.js';
import { playSfx } from './audio.js';
import { spawnParticles } from './fx.js';
import { hurtEnemy } from './enemies.js';

export function dropLoot(enemy) {
  const p = state.player;
  const cfg = state.director?.curve?.dropChance ?? {};
  const luck = 1 + (p.mods.luckAdd ?? 0) + (p.mods.luckBonus ?? 0);

  // XP soul — always, when the enemy is worth any XP.
  if (enemy.xp > 0) {
    state.pickups.push(mk('xp_soul', enemy.x + rand(14, -14), enemy.y + rand(14, -14), enemy.xp));
  }

  const roll = Math.random() * luck;
  const cChest = cfg.chest ?? 0.012;
  const cNuke = cfg.nuke ?? 0.012;
  const cMagnet = cfg.magnet ?? 0.02;
  const cMeat = cfg.meat ?? 0.02;

  if (roll < cChest) state.pickups.push(mk('chest', enemy.x, enemy.y));
  else if (roll < cChest + cNuke) state.pickups.push(mk('nuke', enemy.x, enemy.y));
  else if (roll < cChest + cNuke + cMagnet) state.pickups.push(mk('magnet', enemy.x, enemy.y));
  else if (roll < cMeat) state.pickups.push(mk('meat', enemy.x, enemy.y));
}

function mk(kind, x, y, value) {
  const def = PICKUPS[kind];
  return {
    kind, x, y, value: value ?? def?.value ?? 0,
    radius: def?.radius ?? 12, def, alive: true, bob: rand(Math.PI * 2),
  };
}

export function updatePickups(dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const k = state.pickups[i];
    if (!k.alive) { state.pickups.splice(i, 1); continue; }
    k.bob += dt * 4;
    const d = dist(k.x, k.y, p.x, p.y);
    const magnetR = p.magnetRadius * (p.mods.magnetMult ?? 1) * 2.2;

    // Magnetised pickups ease toward the player once inside the radius.
    // Pull speed must EXCEED the player's own speed or a moving player
    // outruns their own loot — the classic survivors collection bug.
    if (k.def?.magnet && d < magnetR) {
      const pull = Math.max(900, p.speed * 4.5);
      const a = Math.atan2(p.y - k.y, p.x - k.x);
      k.x += Math.cos(a) * pull * dt;
      k.y += Math.sin(a) * pull * dt;
    }
    // Generous collection radius — orbs are small and plentiful.
    if (d < p.radius + (k.radius ?? 12) + 26) { collect(k); k.alive = false; }
  }
}

function collect(k) {
  const p = state.player;
  playSfx('pickup');
  switch (k.kind) {
    case 'xp_soul':
      p.pendingLevels = (p.pendingLevels ?? 0) + grantXp(k.value);
      break;
    case 'gold_coin':
      p.gold += k.value;
      break;
    case 'meat':
      healPlayer(k.value);
      spawnParticles(p.x, p.y, 20, '#ff7a3d', 8);
      break;
    case 'magnet':
      for (const o of state.pickups) {
        if (o === k) continue;
        const a = Math.atan2(p.y - o.y, p.x - o.x);
        o.x += Math.cos(a) * 900;
        o.y += Math.sin(a) * 900;
      }
      break;
    case 'nuke':
      spawnParticles(p.x, p.y, 400, '#ff4d4d', 40);
      state.shake = 22;
      playSfx('explode');
      for (const e of state.enemies) {
        if (e.alive) hurtEnemy(e, k.value || 300, p.x, p.y, 260);
      }
      break;
    case 'chest':
      p.pendingLevels = (p.pendingLevels ?? 0) + 3;
      break;
  }
}
