// Meta progression: gold bank, owned heroes, leaderboard.
// Persisted to localStorage under 'bloodarena.meta'. No network, no wallet
// required — the game is fully playable offline; a wallet layer can be added
// later on top of this same data model.

import { state } from './state.js';

const KEY = 'bloodarena.meta';

const DEFAULTS = {
  bestTime: 0,
  bestKills: 0,
  runs: 0,
  gold: 0,                 // banked currency
  points: 0,               // from score + leaderboard; redeemable for gold
  unlockedChars: ['survivor'],
  activeChar: 'survivor',
  ownedUpgrades: [],       // permanent shop upgrades
  ownedWeapons: [],        // purchased weapons, offered in the level-up pool
  leaderboard: [],         // [{score, kills, time, level, char, at}]
};

export function loadMeta() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    state.meta = { ...DEFAULTS, ...state.meta, ...parsed };
  } catch {
    state.meta = { ...DEFAULTS, ...state.meta };
  }
  // Guard against a corrupt or hand-edited save.
  const m = state.meta;
  if (!Array.isArray(m.leaderboard)) m.leaderboard = [];
  if (!Array.isArray(m.unlockedChars) || !m.unlockedChars.length) m.unlockedChars = ['survivor'];
  if (!Array.isArray(m.ownedUpgrades)) m.ownedUpgrades = [];
  if (typeof m.gold !== 'number' || !Number.isFinite(m.gold)) m.gold = 0;
  return m;
}

export function saveMeta() {
  try { localStorage.setItem(KEY, JSON.stringify(state.meta)); } catch {}
}

/** Add to the gold bank. */
export function bankGold(n) {
  state.meta.gold = (state.meta.gold ?? 0) + Math.max(0, Math.round(n));
  saveMeta();
  return state.meta.gold;
}

// --- POINTS <-> GOLD ---------------------------------------------------------
// Points accrue from score and leaderboard placement. The rate is deliberately
// slow: 1000 pts -> 10 gold, 10000 pts -> 100 gold. Gold can also be bought
// with SOL at 100,000 gold per 0.1 SOL (the on-chain path is not wired yet).

const ECON = {
  goldPerPoint: 0.1,
  pointPerScore: 1.0,
  pointsPerGoldBought: 100,
  goldPerSol: 100000,
};

export function addPoints(points) {
  state.meta.points = (state.meta.points ?? 0) + Math.max(0, Math.round(points));
  saveMeta();
  return state.meta.points;
}

export function pointsToGold(points) {
  return Math.floor((points ?? 0) * ECON.goldPerPoint);
}

/** Convert banked points into gold. Returns {ok, gold, points}. */
export function redeemPoints(points) {
  const have = state.meta.points ?? 0;
  const take = Math.min(have, Math.max(0, Math.floor(points)));
  if (take <= 0) return { ok: false, gold: 0, points: have };
  const gold = pointsToGold(take);
  state.meta.points = have - take;
  state.meta.gold = (state.meta.gold ?? 0) + gold;
  saveMeta();
  return { ok: true, gold, points: state.meta.points };
}

export function goldForSol(sol) {
  return Math.floor((sol ?? 0) * ECON.goldPerSol);
}

export function econRates() { return { ...ECON }; }

export function ownsChar(id) {
  return (state.meta.unlockedChars ?? []).includes(id);
}

/** Buy a hero. Returns {ok, reason}. */
export function buyCharacter(char) {
  if (!char) return { ok: false, reason: 'unknown' };
  if (ownsChar(char.id)) return { ok: false, reason: 'owned' };
  if ((state.meta.gold ?? 0) < (char.price ?? 0)) return { ok: false, reason: 'gold' };
  state.meta.gold -= char.price;
  state.meta.unlockedChars.push(char.id);
  saveMeta();
  return { ok: true };
}

export function equipCharacter(id) {
  if (!ownsChar(id)) return false;
  state.meta.activeChar = id;
  saveMeta();
  return true;
}

/** Buy a permanent upgrade. Returns {ok, reason}. */
export function buyUpgrade(up) {
  if (!up) return { ok: false, reason: 'unknown' };
  if ((state.meta.ownedUpgrades ?? []).includes(up.id)) return { ok: false, reason: 'owned' };
  if ((state.meta.gold ?? 0) < (up.price ?? 0)) return { ok: false, reason: 'gold' };
  state.meta.gold -= up.price;
  state.meta.ownedUpgrades.push(up.id);
  saveMeta();
  return { ok: true };
}

/** Buy a weapon. Returns {ok, reason}. */
export function buyWeapon(w) {
  if (!w) return { ok: false, reason: 'unknown' };
  if ((state.meta.ownedWeapons ?? []).includes(w.id)) return { ok: false, reason: 'owned' };
  if ((state.meta.gold ?? 0) < (w.price ?? 0)) return { ok: false, reason: 'gold' };
  state.meta.gold -= w.price;
  state.meta.ownedWeapons.push(w.id);
  saveMeta();
  return { ok: true };
}

export function ownsWeapon(id) {
  return (state.meta.ownedWeapons ?? []).includes(id);
}

/** Record a finished run. Returns the 1-based rank, or 0 if it did not place. */
export function recordScore(entry, size = 10) {
  const lb = state.meta.leaderboard;
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  state.meta.leaderboard = lb.slice(0, size);
  saveMeta();
  return state.meta.leaderboard.indexOf(entry) + 1;
}

export function bestScore() {
  const lb = state.meta.leaderboard;
  return lb.length ? lb[0].score : 0;
}
