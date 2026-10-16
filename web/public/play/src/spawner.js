// Wave director. Time-based difficulty, ring-outside-viewport spawning
// (THE canonical VS pattern), hard alive cap, map events, boss trigger.

import { state } from './state.js';
import { SPAWN_CURVE, ENEMIES } from './catalogs.js';
import { clamp } from './util.js';
import { spawnEnemy } from './enemies.js';

export function createDirector(curve) {
  return {
    curve,
    maxAlive: curve.maxAlive ?? 300,
    nextSpawn: 0,
    firedEvents: new Set(),
    currentWave: null,
    bossTriggered: false,
  };
}

export function difficultyAt(elapsed, curve) {
  const mins = elapsed / 60;
  const d = curve.difficulty ?? {};
  return {
    hp: Math.min(d.maxHpMult ?? 6, 1 + mins * (d.hpPerMinute ?? 0.28)),
    speed: Math.min(d.maxSpeedMult ?? 1.8, 1 + mins * (d.speedPerMinute ?? 0.045)),
    count: 1 + mins * (d.countPerMinute ?? 0.10),
  };
}

function activeWave(elapsed, curve) {
  let best = null;
  for (const w of curve.waves) {
    if (elapsed >= w.startTime) best = w;
  }
  return best;
}

// Pick a random point on a ring just outside the visible viewport.
export function ringPoint(player, viewport, margin) {
  // state.camera names its size w/h (not width/height). Reading the wrong keys
  // yields NaN here, and every enemy then spawns at (NaN, NaN) — frozen.
  const vw = viewport?.w ?? viewport?.width ?? 1280;
  const vh = viewport?.h ?? viewport?.height ?? 720;
  const theta = Math.random() * Math.PI * 2;
  const halfDiag = Math.hypot(vw, vh) / 2 + margin;
  const x = player.x + Math.cos(theta) * halfDiag;
  const y = player.y + Math.sin(theta) * halfDiag;
  return {
    x: clamp(Number.isFinite(x) ? x : player.x, 30, state.arena.width - 30),
    y: clamp(Number.isFinite(y) ? y : player.y, 30, state.arena.height - 30),
  };
}

export function updateDirector(dt) {
  const dir = state.director;
  if (!dir) return;
  const p = state.player;
  const elapsed = state.elapsed;
  const diff = difficultyAt(elapsed, dir.curve);

  // Active wave (last one whose startTime has passed).
  const wave = activeWave(elapsed, dir.curve);
  dir.currentWave = wave;
  if (wave && state.enemies.length < dir.maxAlive) {
    dir.nextSpawn -= dt;
    if (dir.nextSpawn <= 0) {
      dir.nextSpawn = wave.interval / diff.count;
      const def = ENEMIES[wave.enemyType];
      if (def) {
        // Spawn a BURST, not one enemy. A survivors game needs a crowd on
        // screen immediately — minCount is the per-tick batch size, scaled
        // by the difficulty curve and capped by the alive limit.
        const burst = Math.max(1, Math.round(((wave.minCount ?? 6) / 6) * diff.count));
        for (let i = 0; i < burst; i++) {
          if (state.enemies.length >= dir.maxAlive) break;
          const pt = ringPoint(p, state.camera, dir.curve.spawnRing?.innerMargin ?? 80);
          spawnEnemy(def, pt.x, pt.y, diff.hp, diff.speed, rollModifier(elapsed, dir.curve));
        }
      }
    }
  }

  // map events
  for (const ev of dir.curve.mapEvents ?? []) {
    if (elapsed < ev.at || dir.firedEvents.has(ev)) continue;
    dir.firedEvents.add(ev);
    if (ev.kind === 'encircling_swarm') encircle(ev, dir, diff);
    if (ev.kind === 'boss') triggerBoss(ev);
  }
}

function rollModifier(elapsed, curve) {
  for (const m of curve.modifiers ?? []) {
    if (elapsed < m.fromTime) continue;
    if (Math.random() < m.chance) return m;
  }
  return null;
}

// Ring of enemies closing in from all sides — the classic VS pressure event.
function encircle(ev, dir, diff) {
  const p = state.player;
  const R = 520;
  for (let i = 0; i < ev.count; i++) {
    const a = (i / ev.count) * Math.PI * 2;
    const def = ENEMIES[ev.type];
    if (!def) continue;
    spawnEnemy(def, clamp(p.x + Math.cos(a) * R, 30, state.arena.width - 30),
      clamp(p.y + Math.sin(a) * R, 30, state.arena.height - 30), diff.hp, diff.speed, null);
  }
}

function triggerBoss(ev) {
  const dir = state.director;
  if (dir.bossTriggered) return;
  dir.bossTriggered = true;
  window.dispatchEvent(new CustomEvent('ogf:boss', { detail: { type: ev.type } }));
}

// Apply a modifier's multipliers to a freshly spawned enemy.
export function applyModifier(e, mod) {
  if (!mod || !e) return;
  if (mod.hpMult) { e.hp *= mod.hpMult; e.maxHp *= mod.hpMult; }
  if (mod.speedMult) e.speed *= mod.speedMult;
  e.tint = mod.tint;
  e.modId = mod.id;
}
