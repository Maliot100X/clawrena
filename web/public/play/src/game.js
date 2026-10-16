// Entry point + frame loop. Keeps this file thin: it wires modules and owns
// the run lifecycle (title -> playing -> levelup -> results/win).

import { state, resetRun } from './state.js';
import { loadCatalogs, ENEMY_LIST, PICKUPS } from './catalogs.js';
import { loadJSON } from './assets.js';
import {
  initRenderer, beginFrame, drawWorld, drawHud, drawOverlay, errorScreen,
  preloadImages, uiRects, shopRects,
} from './render.js';
import {
  loadMeta, saveMeta, bankGold, buyCharacter, equipCharacter, buyUpgrade,
  ownsChar, recordScore, addPoints, redeemPoints, buyWeapon, ownsWeapon,
  goldForSol, econRates,
} from './meta.js';
import { initInput, readInput, pressedOnce, endFrame, onCanvasClick, tappedOnce, tapPoint } from './input.js';
import { initAudio, playSfx } from './audio.js';
import { updatePlayer, damagePlayer } from './player.js';
import { updateEnemies } from './enemies.js';
import {
  updateProjectiles, updateParticles, updateMines, updateShake,
} from './fx.js';
import { updateWeapons, tickEnemyCooldowns } from './weapons.js';
import { updatePickups } from './loot.js';
import { createDirector, updateDirector } from './spawner.js';
import { maybeLevelUp, applyChoice } from './levelup.js';
import { updateBoss, spawnBoss } from './boss.js';
import { clamp } from './util.js';
import { installProtocol, applyUrlParams } from './ai/protocol.js';
import { configureBrain, brainMove, decideChoice } from './ai/brain.js';
import { STRATEGIES } from './ai/strategies.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let levels = [];
let brainBusy = false;

// Flip AI autopilot on/off from the on-screen button, the keyboard, or the
// external agent protocol. Keeps SurvivorsAPI and state in sync.
function toggleAutopilot(force) {
  state.autopilot = force === undefined ? !state.autopilot : !!force;
  try { window.SurvivorsAPI?.setAutopilot?.(state.autopilot); } catch {}
  playSfx('uiClick');
  return state.autopilot;
}

// Real fullscreen on phones — hides browser chrome so the whole screen is game.
function toggleFullscreen() {
  const el = document.documentElement;
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  try {
    if (!isFs) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    }
  } catch {}
  playSfx('uiClick');
}

function openShop() {
  state.showShop = true;
  state.shopTab = state.shopTab ?? 'chars';
  state.shopNotice = null;
  playSfx('uiClick');
}

function handleShopTap(px, py) {
  const R = shopRects();
  const hit = (r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

  if (hit(R.close)) { state.showShop = false; playSfx('uiClick'); return; }
  if (hit(R.redeem)) {
    const res = redeemPoints(state.meta.points ?? 0);
    state.shopNotice = res.ok
      ? `Redeemed ${res.gold} gold. ${res.points} pts left.`
      : 'No points to redeem — finish a run.';
    playSfx(res.ok ? 'levelUp' : 'hurt');
    return;
  }
  for (const t of R.tabs) {
    if (hit(t)) { state.shopTab = t.id; state.shopPage = 0; playSfx('uiClick'); return; }
  }
  // Pager — every item is reachable without scrolling.
  if (hit(R.prev)) { state.shopPage = Math.max(0, (state.shopPage ?? 0) - 1); playSfx('uiClick'); return; }
  if (hit(R.next)) {
    const tab = state.shopTab;
    const full = tab === 'chars' ? (state.shopData?.characters?.length ?? 0)
               : tab === 'weapons' ? (state.shopData?.weapons?.length ?? 0)
               : (state.shopData?.upgrades?.length ?? 0);
    const per = R.slots;
    const pages = Math.max(1, Math.ceil(full / per));
    state.shopPage = Math.min(pages - 1, (state.shopPage ?? 0) + 1);
    playSfx('uiClick');
    return;
  }

  const shop = state.shopData;
  if (!shop) return;

  const per = R.slots;
  const abs = (i) => (state.shopPage ?? 0) * per + i;

  for (const r of R.cards) {
    if (!hit(r)) continue;
    const tab = state.shopTab;

    if (tab === 'chars') {
      const ch = shop.characters[abs(r.index)]; if (!ch) return;
      if (ownsChar(ch.id)) {
        equipCharacter(ch.id);
        state.activeHeroMods = ch.mods ?? {};
        state.shopNotice = `${ch.name} equipped.`;
        playSfx('uiClick');
      } else {
        const res = buyCharacter(ch);
        state.shopNotice = res.ok ? `${ch.name} unlocked!`
          : res.reason === 'owned' ? 'Already owned.'
          : `Need ${ch.price - (state.meta.gold ?? 0)} more gold.`;
        playSfx(res.ok ? 'levelUp' : 'hurt');
      }
      return;
    }

    if (tab === 'weapons') {
      const w = shop.weapons[abs(r.index)]; if (!w) return;
      if (ownsWeapon(w.id)) { state.shopNotice = `${w.name} already owned.`; playSfx('uiClick'); return; }
      const res = buyWeapon(w);
      state.shopNotice = res.ok ? `${w.name} purchased — it can now appear on level-up.`
        : `Need ${w.price - (state.meta.gold ?? 0)} more gold.`;
      playSfx(res.ok ? 'levelUp' : 'hurt');
      return;
    }

    if (tab === 'upgrades') {
      const up = shop.upgrades[abs(r.index)]; if (!up) return;
      const res = buyUpgrade(up);
      state.shopNotice = res.ok ? `${up.name} purchased!`
        : res.reason === 'owned' ? 'Already owned.'
        : `Need ${up.price - (state.meta.gold ?? 0)} more gold.`;
      playSfx(res.ok ? 'levelUp' : 'hurt');
      return;
    }
    return;   // leaderboard rows are not interactive
  }
}

async function startRun(levelId) {
  const meta = levels.find((l) => l.id === levelId) ?? levels[0];
  const level = await loadJSON(meta.file);
  state.level = level;
  state.levelId = level.id;

  // Levels come in two shapes: the OGF editor shape (runtime{} nested,
  // spawn{}, mapSize{}) and the flat runtime shape (arena{}, playerSpawn{}).
  // Normalise both here so the rest of the game has one contract.
  const rt = level.runtime ?? {};
  state.arena = { ...(level.arena ?? rt.arena ?? { width: 3000, height: 3000, wrap: false }) };
  state.background = level.background ?? rt.background ?? null;
  if (state.background && typeof state.background === 'string') {
    state.background = { tile: state.background, tileW: 256, tileH: 256, scrollWith: 'camera' };
  }
  state.camera.w = canvas.width; state.camera.h = canvas.height;

  const spawn = level.playerSpawn ?? level.spawn ?? { x: state.arena.width / 2, y: state.arena.height / 2 };
  resetRun({ ...level, playerSpawn: spawn });

  const { AUDIO, SPAWN_CURVE } = await import('./catalogs.js');
  state.director = createDirector(SPAWN_CURVE);
  state.props = level.props ?? [];
  initAudio(AUDIO);

  // Preload every image this level needs BEFORE the run becomes visible.
  // Without this the first frames draw fallbacks, and an unloaded ground tile
  // leaves the viewport blank — which reads as "the scene is empty".
  await preloadImages([
    state.background?.tile,
    state.background?.image,
    ...state.props.map((pr) => pr.sprite),
    ...ENEMY_LIST.map((e) => e.sprite),
    ...Object.values(PICKUPS).map((p) => p.sprite),
  ]);

  const bossSpawn = level.bossSpawn ?? rt.bossSpawn;
  if (bossSpawn) {
    const b = spawnBoss(bossSpawn.type, bossSpawn.x, bossSpawn.y);
    if (b) state.bossRef = b;
  }

  state.scene = 'playing';
  state.paused = false;
}

function updateCamera() {
  const p = state.player;
  const vw = canvas.width, vh = canvas.height;
  if (state.level?.camera === 'locked') {
    state.camera.x = (state.arena.width - vw) / 2;
    state.camera.y = (state.arena.height - vh) / 2;
    return;
  }
  state.camera.x = clamp(p.x - vw / 2, 0, Math.max(0, state.arena.width - vw));
  state.camera.y = clamp(p.y - vh / 2, 0, Math.max(0, state.arena.height - vh));
}

window.__endRun = (w) => endRun(w);
function endRun(win) {
  const p = state.player;
  const score = Math.round(p.kills * 10 + state.elapsed * 5 + p.gold);
  state.results = { win, time: state.elapsed, kills: p.kills, level: p.level, gold: p.gold, score };
  const m = state.meta;
  m.runs++;
  if (state.elapsed > m.bestTime) m.bestTime = state.elapsed;
  if (p.kills > m.bestKills) m.bestKills = p.kills;
  if (m.runs >= 3 && !m.unlockedChars.includes('reaver')) m.unlockedChars.push('reaver');

  // Bank this run's gold, award points from score, and record the leaderboard.
  bankGold(p.gold ?? 0);
  const points = Math.round(score * 1.0);
  addPoints(points);
  state.results.points = points;

  state.results.rank = recordScore({
    score, kills: p.kills, time: Math.round(state.elapsed),
    level: p.level, char: m.activeChar, at: Date.now(),
  }, 10);
  // Podium finish pays a point bonus, so the leaderboard is worth chasing.
  if (state.results.rank >= 1 && state.results.rank <= 3) {
    const bonus = [5000, 2500, 1200][state.results.rank - 1];
    addPoints(bonus);
    state.results.rankBonus = bonus;
  }

  saveMeta();
  state.scene = 'results';
  state.paused = true;
}

async function handleAutopilot(dt) {
  if (!state.autopilot || state.scene !== 'playing') return;
  const p = state.player;
  const intent = brainMove(p, state.enemies, state.pickups, {
    width: state.arena.width, height: state.arena.height,
  });
  return intent;
}

function step(dt) {
  const p = state.player;
  state.elapsed += dt;

  let input = readInput();
  if (state.autopilot) {
    const intent = state._aiIntent;
    if (intent) input = { ...input, ax: intent.ax, ay: intent.ay, dashPressed: false };
    // naive auto-dash when a threat is very close
    const close = state.enemies.some((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 70);
    if (close && p.dashCd <= 0) input.dashPressed = true;
  }

  updatePlayer(dt, input);
  updateWeapons(dt);
  tickEnemyCooldowns(dt);
  updateEnemies(dt);

  // boss gets its own update, skipped by generic AI (knockbackResist 1 + isBoss)
  if (state.bossRef && state.bossRef.alive) updateBoss(state.bossRef, dt);
  if (state.bossRef && !state.bossRef.alive && !state.results) {
    state.bossRef = null;
    endRun(true);
    return;
  }

  updateProjectiles(dt);
  updateMines(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateDirector(dt);
  updateShake(dt);
  updateCamera();

  if (!p.alive && state.scene === 'playing') endRun(false);
  if (!state.results) maybeLevelUp();
}

async function handleLevelUpInput() {
  const cards = state.levelupChoices;
  if (!cards.length) return;

  // The card box stays on screen for a grace period so the PLAYER can choose
  // first. If they don't, the brain picks. (Autopilot must never snatch the
  // choice away instantly — that removed the player's agency entirely.)
  state.levelupShownMs = (state.levelupShownMs ?? 0) + (state.dtMs ?? 16);
  const graceMs = state.autopilot ? 10000 : Infinity;
  const playerMayAct = !state.autopilot || state.levelupShownMs >= graceMs;

  // autopilot / external decision — only after the grace window elapses.
  if ((state.autopilot || state.decisionMode === 'external') && state.levelupShownMs >= graceMs) {
    if (brainBusy) return;
    brainBusy = true;
    const { index, source } = await decideChoice('levelup', cards, {
      hp: state.player.hp, maxHp: state.player.maxHp,
      level: state.player.level, strategy: state.strategy,
    });
    brainBusy = false;
    applyChoice(cards[index] ?? cards[0]);
    state.levelupChoices = [];
    state.scene = 'playing';
    state.paused = false;
    state.levelupShownMs = 0;
    state._lastDecision = source;
    return;
  }
  if (!playerMayAct) return;

  // keyboard OR tap — the player takes the card themselves.
  for (let i = 0; i < cards.length; i++) {
    if (pressedOnce('Digit' + (i + 1))) {
      applyChoice(cards[i]);
      state.levelupChoices = [];
      state.scene = 'playing'; state.paused = false;
      state.levelupShownMs = 0;
      return;
    }
  }
  if (tappedOnce()) {
    const pt = tapPoint();
    const W = canvas.width, H = canvas.height;
    const gap = Math.max(10, Math.round(W * 0.02));
    const maxRow = W * 0.94;
    const cw = Math.min(320, Math.floor((maxRow - gap * (cards.length - 1)) / cards.length));
    const ch = Math.round(cw * 0.62);
    const total = cards.length * cw + (cards.length - 1) * gap;
    const x0 = (W - total) / 2;
    const y0 = H / 2 - ch / 2;
    for (let i = 0; i < cards.length; i++) {
      const cx = x0 + i * (cw + gap);
      if (pt.x >= cx && pt.x <= cx + cw && pt.y >= y0 && pt.y <= y0 + ch) {
        applyChoice(cards[i]);
        state.levelupChoices = [];
        state.scene = 'playing'; state.paused = false;
        return;
      }
    }
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last ?? now)) / 1000);
  state.dtMs = dt * 1000;   // frame delta in ms — drives the card grace window
  frame.last = now;
  state.dt = dt;

  // AI intent is computed once per frame, outside the paused check
  if (state.autopilot && state.scene === 'playing') {
    const p = state.player;
    state._aiIntent = brainMove(p, state.enemies, state.pickups, {
      width: state.arena.width, height: state.arena.height,
    });
  }

  if (state.scene === 'playing' && !state.paused) step(dt);

  if (state.scene === 'levelup') handleLevelUpInput();

  if (state.scene === 'title') {
    // Touch has no keyboard — a tap anywhere on the canvas starts the run.
    const startNow = pressedOnce('Enter') || pressedOnce('Space') || tappedOnce();
    if (startNow) startRun('blood_arena');
    if (pressedOnce('KeyA')) { state.autopilot = true; startRun('blood_arena'); }
  } else if (state.scene === 'results') {
    if (pressedOnce('Enter') || pressedOnce('Space') || tappedOnce()) startRun('blood_arena');
  }

  beginFrame();
  drawWorld();
  drawHud();
  drawOverlay();

  endFrame();
  requestAnimationFrame(frame);
}

async function boot() {
  initRenderer(canvas, ctx);
  initInput(canvas);
  loadMeta();
  // Restore the equipped hero's mods so a saved loadout applies on the next run.
  try {
    const shopNow = await loadJSON('data/shop.json');
    const hero = (shopNow.characters ?? []).find((c) => c.id === state.meta.activeChar);
    state.activeHeroMods = hero?.mods ?? {};
  } catch { state.activeHeroMods = {}; }
  installProtocol();
  applyUrlParams();

  // Show the touch-control hint on touch-capable devices only.
  state.showTouchHint =
    ('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0;

  // Brain config: window override > data/settings.json > heuristic floor.
  // The API key is NEVER stored in settings.json — it is injected at runtime
  // via window.BLOOD_ARENA_LLM.apiKey (or left null for the heuristic).
  let cfg = null;
  try { cfg = await loadJSON('data/settings.json'); } catch {}
  const win = window.BLOOD_ARENA_LLM ?? {};
  configureBrain({
    endpoint: win.endpoint ?? cfg?.brain?.endpoint ?? null,
    apiKey: win.apiKey ?? null,
    model: win.model ?? cfg?.brain?.model ?? null,
    timeoutMs: cfg?.brain?.timeoutMs ?? 1200,
  });
  if (cfg?.strategy) state.strategy = cfg.strategy;
  if (cfg?.autopilotStart) state.autopilot = true;

  try {
    await loadCatalogs();
    const reg = await loadJSON('data/levels.json');
    levels = reg.levels;
    // Shop catalog is optional — a missing file must not break the game.
    try { state.shopData = await loadJSON('data/shop.json'); } catch { state.shopData = null; }
    // Economy knobs live in data/, never inline in code.
    try {
      const curve = await loadJSON('data/spawn-curve.json');
      state.goldPerKill = curve.goldPerKill ?? 2;
      state.goldPerBoss = curve.goldPerBoss ?? 1200;
      state.goldPerLevel = curve.goldPerLevel ?? 25;
    } catch {}
  } catch (err) {
    errorScreen('data load failed: ' + err.message);
    return;
  }

  onCanvasClick((ev) => {
    const px = ev.offsetX, py = ev.offsetY;

    // Control buttons first — they overlay every scene, and hit-testing the
    // same uiRects() the renderer drew keeps the tap aligned with the visual.
    const { ai, settings, full, shop } = uiRects();
    const inside = (r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

    // SHOP — full-screen overlay with characters, upgrades and the leaderboard.
    if (state.showShop) {
      handleShopTap(px, py);
      return;
    }
    if (inside(shop)) { openShop(); return; }

    // FULLSCREEN — the phone needs a real fullscreen switch, not a browser menu.
    if (inside(full)) { toggleFullscreen(); return; }

    if (state.showSettings) {
      if (inside(ai)) { toggleAutopilot(); return; }
      if (inside(settings)) { state.showSettings = false; return; }
      // Anywhere else in the panel closes it.
      state.showSettings = false;
      return;
    }
    if (inside(ai)) { toggleAutopilot(); return; }
    if (inside(settings)) { state.showSettings = true; return; }

    // Title: a tap anywhere begins the run (no keyboard on a phone).
    if (state.scene === 'title') { startRun('blood_arena'); return; }
    if (state.scene === 'results') { startRun('blood_arena'); return; }

    if (state.scene !== 'levelup') return;
    // During the grace window the player may take the card themselves even
    // with autopilot on. After it expires the brain decides instead.
    if (state.autopilot && (state.levelupShownMs ?? 0) >= 10000) return;

    const cards = state.levelupChoices;
    const W = canvas.width, H = canvas.height;
    const gap = Math.max(10, Math.round(W * 0.02));
    const maxRow = W * 0.94;
    const cw = Math.min(320, Math.floor((maxRow - gap * (cards.length - 1)) / cards.length));
    const ch = Math.round(cw * 0.62);
    const total = cards.length * cw + (cards.length - 1) * gap;
    const x0 = (W - total) / 2;
    const y0 = H / 2 - ch / 2;
    for (let i = 0; i < cards.length; i++) {
      const cx = x0 + i * (cw + gap);
      if (px >= cx && px <= cx + cw && py >= y0 && py <= y0 + ch) {
        applyChoice(cards[i]);
        state.levelupChoices = [];
        state.scene = 'playing'; state.paused = false;
        break;
      }
    }
  });

  requestAnimationFrame(frame);
}

boot();
