// Deterministic strategy engine. This is the FLOOR — autopilot always works,
// even with no LLM reachable. Scores upgrade cards and picks move intent.

import { STRATEGIES } from './strategies.js';

// Score a level-up card against the active strategy, 0..1.
export function scoreCard(card, strategyId) {
  const s = STRATEGIES[strategyId] ?? STRATEGIES.survivor;
  let score = 0.5;
  switch (card.kind) {
    case 'evolve': score = 1.0; break;
    case 'weapon': score = 0.55 + 0.25 * s.weaponBias; break;
    case 'newWeapon': score = 0.40 + 0.30 * s.weaponBias; break;
    case 'passive': {
      const id = card.id ?? '';
      if (['damage', 'area'].includes(id)) score = 0.5 + 0.25 * s.offenseBias;
      else if (['max_hp', 'armor', 'regen'].includes(id)) score = 0.45 + 0.25 * s.flee;
      else if (['magnet', 'xp', 'luck'].includes(id)) score = 0.4 + 0.25 * s.lootBias;
      else if (['speed', 'cooldown'].includes(id)) score = 0.5 + 0.15 * (s.flee + s.offenseBias);
      break;
    }
    case 'heal': score = 0.2; break;
  }
  return Math.max(0, Math.min(1, score));
}

export function pickCard(cards, strategyId) {
  let best = 0, bestScore = -1;
  for (let i = 0; i < cards.length; i++) {
    const sc = scoreCard(cards[i], strategyId);
    if (sc > bestScore) { bestScore = sc; best = i; }
  }
  return best;
}

// Movement intent: retreat vector + loot attraction, blended by strategy.
export function moveIntent(player, enemies, pickups, strategyId, viewport) {
  const s = STRATEGIES[strategyId] ?? STRATEGIES.survivor;
  let ax = 0, ay = 0;

  // Threat avoidance — weight nearby enemies, closer = stronger.
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = 220;
    if (d < range) {
      const w = (1 - d / range) * (1 + s.flee);
      ax += (dx / d) * w;
      ay += (dy / d) * w;
    }
  }

  // Loot attraction.
  let bestP = null, bestD = 1e9;
  for (const k of pickups) {
    if (!k.alive) continue;
    const d = Math.hypot(k.x - player.x, k.y - player.y);
    if (d < bestD) { bestD = d; bestP = k; }
  }
  if (bestP && bestD < 700) {
    const dx = bestP.x - player.x, dy = bestP.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = Math.min(1.6, 420 / d) * s.lootBias;
    ax += (dx / d) * w;
    ay += (dy / d) * w;
  }

  // Hunter engages the nearest enemy instead of only fleeing.
  if (s.engage > 0) {
    let n = null, nd = 1e9;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < nd) { nd = d; n = e; }
    }
    if (n) {
      const dx = n.x - player.x, dy = n.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      ax += (dx / d) * s.engage;
      ay += (dy / d) * s.engage;
    }
  }

  // Keep off the arena walls.
  const m = 140;
  if (player.x < m) ax += (m - player.x) / m;
  if (player.x > viewport.width - m) ax -= (player.x - (viewport.width - m)) / m;
  if (player.y < m) ay += (m - player.y) / m;
  if (player.y > viewport.height - m) ay -= (player.y - (viewport.height - m)) / m;

  // Normalize into the axis-input shape the player controller expects.
  const len = Math.hypot(ax, ay);
  if (len < 1e-3) return { ax: 0, ay: 0 };
  return { ax: ax / len, ay: ay / len };
}
