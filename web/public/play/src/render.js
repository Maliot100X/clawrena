// Canvas 2D renderer. Draws arena, entities, HUD, overlays.
// Sprites load from assets/; when a sheet is missing we fall back to a
// clean vector silhouette so the game is ALWAYS playable — never a blank screen.

import { state } from './state.js';
import { ENEMIES, WEAPONS, PICKUPS } from './catalogs.js';
import { clamp } from './util.js';
import { stickState } from './input.js';

let canvas = null, ctx = null;
const IMG = new Map();      // path -> HTMLImageElement | null
const PALETTE = {
  bg: '#2a2028', ground: '#453a45', stone: '#5a4a5c', bone: '#d9c8a9',
  rust: '#8b1a2b', violet: '#b26bff', ember: '#ff7a3d', cyan: '#4fd6ff',
  gold: '#ffd24a', hp: '#e0405a', xp: '#4fd6ff', white: '#f2ece2', emerald: '#5ad98a',
};

export function initRenderer(c, context) {
  canvas = c; ctx = context;
  ctx.imageSmoothingEnabled = false;
}

// Preload image paths before the run starts. Awaiting this means the first
// drawn frame already has real art — no vector fallbacks popping in, and no
// window where an unloaded tile reads as a blank screen.
export async function preloadImages(paths) {
  const uniq = [...new Set((paths ?? []).filter(Boolean))];
  await Promise.all(uniq.map(p => new Promise(res => {
    if (IMG.get(p)) return res();
    const img = new Image();
    img.onload = () => { IMG.set(p, img); res(); };
    img.onerror = () => { IMG.set(p, null); res(); };
    img.src = p;
  })));
  return uniq.length;
}

export function getImage(path) {
  if (!path) return null;
  const cached = IMG.get(path);
  if (cached) return cached;
  // Not loaded yet — kick off a request and draw the fallback this frame.
  // Never cache null here, or a slow image would stay invisible forever.
  const img = new Image();
  img.onload = () => IMG.set(path, img);
  img.src = path;
  return null;
}

export function errorScreen(msg) {
  if (!ctx) return;
  ctx.fillStyle = '#160b0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e0405a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('Blood Arena — ' + msg, 40, 60);
}

export function beginFrame() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // screenshake
  if (state.shake > 0) {
    const s = state.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  ctx.translate(-Math.round(state.camera.x), -Math.round(state.camera.y));
}

export function drawWorld() {
  drawGround();
  drawProps();
  drawMines();
  drawPickups();
  drawOrbits();
  drawEnemies();
  drawProjectiles();
  drawPlayer();
  drawParticles();
}

function drawGround() {
  // Always lay down an opaque opaque base across the whole visible area first.
  // Without this, any frame where the tile image hasn't decoded shows the
  // page background through the canvas, which reads as an empty scene.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(state.camera.x, state.camera.y, state.camera.w, state.camera.h);

  const bg = state.background;
  if (bg?.tile) {
    const img = getImage(bg.tile);
    const tw = bg.tileW, th = bg.tileH;
    const x0 = Math.floor(state.camera.x / tw) * tw;
    const y0 = Math.floor(state.camera.y / th) * th;
    const x1 = state.camera.x + state.camera.w + tw;
    const y1 = state.camera.y + state.camera.h + th;
    if (img) {
      for (let x = x0; x < x1; x += tw)
        for (let y = y0; y < y1; y += th) ctx.drawImage(img, x, y, tw, th);
    } else {
      // deterministic stone grid while the tile finishes loading
      ctx.strokeStyle = 'rgba(59,47,61,0.5)';
      ctx.lineWidth = 1;
      for (let x = x0; x < x1; x += tw) {
        ctx.beginPath(); ctx.moveTo(x, state.camera.y); ctx.lineTo(x, state.camera.y + state.camera.h); ctx.stroke();
      }
      for (let y = y0; y < y1; y += th) {
        ctx.beginPath(); ctx.moveTo(state.camera.x, y); ctx.lineTo(state.camera.x + state.camera.w, y); ctx.stroke();
      }
    }
  } else if (bg?.image) {
    const img = getImage(bg.image);
    if (img) ctx.drawImage(img, 0, 0, state.arena.width, state.arena.height);
    else { ctx.fillStyle = PALETTE.stone; ctx.fillRect(0, 0, state.arena.width, state.arena.height); }
  }
  // arena bounds
  ctx.strokeStyle = 'rgba(178,107,255,0.28)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, state.arena.width, state.arena.height);
}

function drawProps() {
  for (const pr of state.props ?? []) {
    const w = pr.w ?? 64, h = pr.h ?? 64;
    // Props pointing at a sprite sheet get frame-accurate drawing (they may be
    // enemy/pickup art placed as scene decor); flat PNGs draw directly.
    const isSheet = typeof pr.sprite === 'string' && /sheet-transparent|raw-sheet/.test(pr.sprite);
    if (isSheet) {
      if (drawSheet(pr.sprite, pr.x + w / 2, pr.y + h / 2, w, h, 0, 1, false, 1)) continue;
    } else {
      const img = getImage(pr.sprite);
      if (img && img.width) { ctx.drawImage(img, pr.x, pr.y, w, h); continue; }
    }
    // Fallback block only while the image is still in flight.
    ctx.fillStyle = '#3b2f3d';
    ctx.fillRect(pr.x, pr.y, w, h);
    ctx.strokeStyle = '#120c10'; ctx.lineWidth = 2;
    ctx.strokeRect(pr.x, pr.y, w, h);
  }
}

function drawEnemies() {
  const cull = 90;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (Math.abs(e.x - state.camera.x - state.camera.w / 2) > state.camera.w / 2 + cull) continue;
    if (Math.abs(e.y - state.camera.y - state.camera.h / 2) > state.camera.h / 2 + cull) continue;

    const r = e.radius;
    const isBoss = e.def?.kind === 'boss';

    // Real sprite sheet when present; vector creature as fallback.
    // Drawn at 2.4x the collision radius so enemies READ clearly on a phone
    // (a 14px bat at 1x is invisible once the canvas is scaled down).
    const spr = r * 4.2;
    const drew = drawSheet(e.def?.sprite, e.x, e.y, spr, spr,
      e.animTime ?? 0, e.def?.fps ?? 8, e.hurtFlash > 0, e.facing);

    if (!drew) {
      const body = e.hurtFlash > 0 ? '#ffffff'
        : isBoss ? '#6d4a5a' : e.modId === 'juggernaut' ? '#c0b09a' : PALETTE.rust;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.75, r * 0.95, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#120c10'; ctx.lineWidth = Math.max(2, r * 0.14); ctx.stroke();
      ctx.fillStyle = PALETTE.ember;
      ctx.beginPath(); ctx.arc(e.x - r * 0.28, e.y - r * 0.18, Math.max(1.6, r * 0.13), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.x + r * 0.28, e.y - r * 0.18, Math.max(1.6, r * 0.13), 0, Math.PI * 2); ctx.fill();
    }

    // hp bar
    if (e.hp < e.maxHp) {
      const w = Math.max(r * 2, 34);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - w / 2, e.y - r - 14, w, 5);
      ctx.fillStyle = isBoss ? PALETTE.violet : PALETTE.hp;
      ctx.fillRect(e.x - w / 2, e.y - r - 14, w * clamp(e.hp / e.maxHp, 0, 1), 5);
    }
    // elite modifier tint ring
    if (e.modId) {
      ctx.strokeStyle = e.tint ?? PALETTE.violet;
      ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// Sheet grid metadata. generate2dsprite writes rows/cols into
// pipeline-meta.json; different assets use different grids (2x2 for most,
// 3x3 for the boss), so NEVER hardcode — look it up, fall back to 2x2.
const SHEET_GRID = {
  'assets/sprites/the_colossus/walk/sheet-transparent.png': { cols: 3, rows: 3 },
};

function sheetGrid(path) {
  return SHEET_GRID[path] ?? { cols: 2, rows: 2 };
}

// Draw one frame of a sprite sheet centered at x,y.
// Returns false when the sheet isn't loaded yet so callers can fall back.
function drawSheet(path, x, y, w, h, t, fps, flash, facing) {
  if (!path) return false;
  const img = getImage(path);
  if (!img || !img.width) return false;
  const { cols: COLS, rows: ROWS } = sheetGrid(path);
  const fw = img.width / COLS, fh = img.height / ROWS;
  const frame = Math.floor(t * fps) % (COLS * ROWS);
  const sx = (frame % COLS) * fw;
  const sy = Math.floor(frame / COLS) * fh;

  ctx.save();
  ctx.translate(x, y);
  if (facing !== undefined && facing < 0) ctx.scale(-1, 1);
  if (flash) ctx.filter = 'brightness(2.2) saturate(0.3)';
  ctx.drawImage(img, sx, sy, fw, fh, -w / 2, -h / 2 - h * 0.12, w, h);
  ctx.restore();
  ctx.filter = 'none';
  return true;
}

function drawPlayer() {
  const p = state.player;
  if (!p.alive && state.scene !== 'results') return;
  const r = p.radius;
  const flash = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;

  // Pick the sheet for the current action. Each action dir has its own
  // processed sheet from generate2dsprite; fall back to idle if one is absent.
  const PLAYER_SHEET = {
    idle: 'assets/sprites/player/idle/sheet-transparent.png',
    walk: 'assets/sprites/player/walk/sheet-transparent.png',
    attack: 'assets/sprites/player/attack/sheet-transparent.png',
    hurt: 'assets/sprites/player/hurt/sheet-transparent.png',
    death: 'assets/sprites/player/death/sheet-transparent.png',
  };
  const drew = drawSheet(
    PLAYER_SHEET[p.anim] ?? PLAYER_SHEET.idle,
    p.x, p.y, r * 5.0, r * 5.0, p.animTime, 8, flash, p.facing);

  if (!drew) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.8, r, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#241a2c';
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PALETTE.violet; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = PALETTE.bone;
    ctx.beginPath(); ctx.arc(p.x, p.y - r * 0.25, r * 0.5, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PALETTE.violet; ctx.lineWidth = 3;
    const sw = p.facing > 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(p.x + sw * r * 0.6, p.y + r * 0.9);
    ctx.lineTo(p.x + sw * r * 1.5, p.y - r * 1.1);
    ctx.stroke();
  }

  // Dash-ready pip: a small arc under the feet only, and only when dashed.
  // (A ring centred on the player read as a blue line "following" them.)
  if (p.dashCd > 0) {
    const frac = clamp(1 - p.dashCd / 3, 0, 1);
    ctx.strokeStyle = 'rgba(79,214,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y + r * 0.95, r * 0.7, Math.PI * 0.15, Math.PI * 0.15 + frac * Math.PI * 0.7);
    ctx.stroke();
  }
  if (state.debugMagnet) {
    ctx.strokeStyle = 'rgba(178,107,255,0.18)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.magnetRadius * (p.mods.magnetMult ?? 1), 0, Math.PI * 2); ctx.stroke();
  }
  // ^ magnet ring is DEBUG ONLY — default off, so it doesn't read as a giant blob
}

function drawProjectiles() {
  for (const b of state.projectiles) {
    if (!b.alive) continue;
    ctx.fillStyle = b.sprite === 'ember_ring' ? PALETTE.ember : PALETTE.violet;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of state.enemyProjectiles) {
    if (!b.alive) continue;
    ctx.fillStyle = '#ff9a5a';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#120c10'; ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawPickups() {
  for (const k of state.pickups) {
    if (!k.alive) continue;
    const y = k.y + Math.sin(k.bob) * 3;
    const col = k.def?.color ?? PALETTE.gold;

    const img = getImage(k.def?.sprite);
    if (img && img.width) {
      const s = k.radius * 4.4;
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.drawImage(img, k.x - s / 2, y - s / 2, s, s);
      ctx.restore();
    } else {
      ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(k.x, y, k.radius * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

function drawOrbits() {
  for (const o of state.orbits) {
    ctx.fillStyle = PALETTE.cyan;
    ctx.shadowColor = PALETTE.cyan; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.radius * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawMines() {
  for (const m of state.mines) {
    if (!m.alive) continue;
    ctx.strokeStyle = m.arm > 0 ? 'rgba(255,122,61,0.4)' : PALETTE.ember;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawParticles() {
  for (const q of state.particles) {
    const a = clamp(q.life / q.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
}

// ---- HUD (screen space) ----
export function drawHud() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const p = state.player;
  const W = canvas.width;
  const barW = 420;

  // HP
  ctx.fillStyle = 'rgba(10,6,10,0.75)';
  ctx.fillRect(24, 24, barW, 22);
  ctx.fillStyle = PALETTE.hp;
  ctx.fillRect(24, 24, barW * clamp(p.hp / p.maxHp, 0, 1), 22);
  ctx.strokeStyle = '#120c10'; ctx.lineWidth = 2; ctx.strokeRect(24, 24, barW, 22);
  ctx.fillStyle = PALETTE.white; ctx.font = 'bold 13px monospace';
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 32, 40);

  // XP
  ctx.fillStyle = 'rgba(10,6,10,0.75)';
  ctx.fillRect(24, 52, barW, 12);
  ctx.fillStyle = PALETTE.xp;
  ctx.fillRect(24, 52, barW * clamp(p.xp / p.xpNext, 0, 1), 12);
  ctx.strokeStyle = '#120c10'; ctx.strokeRect(24, 52, barW, 12);
  ctx.fillStyle = PALETTE.bone; ctx.font = 'bold 12px monospace';
  ctx.fillText(`LV ${p.level}`, barW + 34, 63);

  // timer / kills / gold
  const mm = String(Math.floor(state.elapsed / 60)).padStart(2, '0');
  const ss = String(Math.floor(state.elapsed % 60)).padStart(2, '0');
  ctx.font = 'bold 26px monospace';
  ctx.fillStyle = PALETTE.white;
  ctx.textAlign = 'center';
  ctx.fillText(`${mm}:${ss}`, W / 2, 44);
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText(`KILLS ${p.kills}`, 24, 88);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`GOLD ${p.gold}`, 160, 88);

  // weapon icons
  let wx = 24;
  ctx.font = 'bold 11px monospace';
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    ctx.fillStyle = 'rgba(10,6,10,0.75)';
    ctx.fillRect(wx, 100, 116, 22);
    ctx.strokeStyle = w.evolved ? PALETTE.violet : '#3b2f3d';
    ctx.lineWidth = 2; ctx.strokeRect(wx, 100, 116, 22);
    ctx.fillStyle = w.evolved ? PALETTE.violet : PALETTE.bone;
    ctx.fillText(`${(def?.name ?? w.id).slice(0, 15)}${w.evolved ? ' *' : ''}`, wx + 6, 115);
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(`L${w.level}`, wx + 96, 115);
    wx += 124;
  }

  // Virtual stick — only visible while the thumb is down on touch.
  const st = stickState();
  if (st.active) {
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = PALETTE.cyan; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(st.origin.x, st.origin.y, st.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = PALETTE.cyan;
    ctx.beginPath();
    ctx.arc(st.origin.x + st.vec.x * st.radius, st.origin.y + st.vec.y * st.radius, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (state.showTouchHint) {
    // Faint resting hint so a first-time touch player knows where to drag.
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = PALETTE.cyan; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(canvas.width * 0.22, canvas.height * 0.68, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = PALETTE.cyan;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('drag to move', canvas.width * 0.22, canvas.height * 0.68 + 74);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  if (state.autopilot) {
    ctx.fillStyle = PALETTE.cyan;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`AI: ${state.strategy.toUpperCase()}`, W - 24, 36);
    ctx.textAlign = 'left';
  }
}

export function drawOverlay() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state.scene === 'title') drawTitle();
  else if (state.scene === 'levelup') drawLevelUp();
  else if (state.scene === 'results') drawResults();
  // Controls ride on top of play so AI can be toggled without a keyboard.
  if (state.scene === 'playing' || state.scene === 'title' || state.scene === 'levelup') {
    drawControls();
    if (state.showSettings) drawSettings();
  }
  if (state.showShop && state.shopData) {
    drawShop(state.shopData, state.shopTab ?? 'chars', state.meta, state.shopNotice);
  }
}

function drawSettings() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(10,6,10,0.86)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.bone;
  ctx.font = 'bold 30px monospace';
  ctx.fillText('SETTINGS', cx, 70);

  ctx.font = '15px monospace';
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillText(`AI autopilot: ${state.autopilot ? 'ON' : 'OFF'}`, cx, 120);
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText(`Strategy: ${state.strategy}`, cx, 146);
  ctx.fillStyle = 'rgba(217,200,169,0.7)';
  ctx.font = '13px monospace';
  ctx.fillText('Tap STRATEGY to cycle: survivor → hunter → collector → berserker', cx, 172);
  ctx.fillText('Tap anywhere else to close', cx, 194);

  const { ai, settings, full } = uiRects();
  drawButton(ai, state.autopilot ? 'AI: ON' : 'AI: OFF', !!state.autopilot);
  drawButton(settings, 'CLOSE', true);
  drawButton(full, isFullscreen() ? 'EXIT FULL' : 'FULLSCREEN', false);
  ctx.textAlign = 'left';
}

// Shared UI geometry. The renderer draws these and input.js hit-tests the
// SAME numbers, so a tap always lands on the button that was drawn.
export function uiRects() {
  const W = canvas.width;
  const w = 132, h = 30, pad = 12;
  const full = { x: pad, y: 76, w, h };
  const shop = { x: pad, y: 112, w, h };
  const ai = { x: W - w - pad, y: 24, w, h };
  const settings = { x: W - w - pad, y: 24 + h + 8, w, h };
  return { ai, settings, full, shop };
}

function drawButton(r, label, on) {
  ctx.fillStyle = on ? 'rgba(79,214,255,0.22)' : 'rgba(10,6,10,0.78)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = on ? PALETTE.cyan : 'rgba(217,200,169,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = on ? PALETTE.cyan : PALETTE.bone;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 4);
  ctx.textAlign = 'left';
}

// Always-visible controls, drawn over every in-game scene.
export function drawControls() {
  const { ai, settings, full, shop } = uiRects();
  drawButton(ai, state.autopilot ? 'AI: ON' : 'AI: OFF', !!state.autopilot);
  drawButton(settings, 'SETTINGS', !!state.showSettings);
  drawButton(full, isFullscreen() ? 'EXIT FULL' : 'FULLSCREEN', false);
  drawButton(shop, 'SHOP', !!state.showShop);
}

function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function drawTitle() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(10,6,10,0.86)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.rust;
  ctx.font = 'bold 64px monospace';
  ctx.fillText('BLOOD ARENA', W / 2, H / 2 - 90);
  ctx.fillStyle = PALETTE.bone;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('S U R V I V O R S', W / 2, H / 2 - 52);
  ctx.fillStyle = PALETTE.violet;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('TAP  or  press ENTER  —  begin the run', W / 2, H / 2 + 20);
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillText('A  —  AI autopilot', W / 2, H / 2 + 50);
  ctx.fillStyle = PALETTE.bone;
  ctx.font = '14px monospace';
  ctx.fillText('KEYBOARD: WASD / Arrows move   ·   Space dash   ·   auto-attack', W / 2, H / 2 + 92);
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillText('TOUCH: drag left side to move   ·   tap right side to dash', W / 2, H / 2 + 114);
  const m = state.meta;
  ctx.fillStyle = 'rgba(217,200,169,0.65)';
  ctx.font = '13px monospace';
  ctx.fillText(`best ${formatTime(m.bestTime)}   ·   best kills ${m.bestKills}   ·   runs ${m.runs}`, W / 2, H / 2 + 140);
  ctx.textAlign = 'left';
}

function drawLevelUp() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = 'rgba(10,6,10,0.7)';
  ctx.fillRect(0, 0, W, H);
  const cards = state.levelupChoices;
  // Fit the card row to the canvas — on a phone the viewport is narrow and a
  // fixed 320px card would clip its text.
  const gap = Math.max(10, Math.round(W * 0.02));
  const maxRow = W * 0.94;
  let cw = Math.min(320, Math.floor((maxRow - gap * (cards.length - 1)) / cards.length));
  const ch = Math.round(cw * 0.62);
  const total = cards.length * cw + (cards.length - 1) * gap;
  let x = (W - total) / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.violet;
  ctx.font = 'bold 30px monospace';
  ctx.fillText('LEVEL UP', W / 2, H / 2 - 170);
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const y = H / 2 - ch / 2;
    ctx.fillStyle = 'rgba(26,20,24,0.96)';
    ctx.fillRect(x, y, cw, ch);
    ctx.strokeStyle = c.kind === 'evolve' ? PALETTE.violet : PALETTE.stone;
    ctx.lineWidth = c.kind === 'evolve' ? 4 : 2;
    ctx.strokeRect(x, y, cw, ch);
    ctx.fillStyle = c.kind === 'evolve' ? PALETTE.violet : PALETTE.bone;
    ctx.font = `bold ${Math.round(cw * 0.062)}px monospace`;
    ctx.fillText(c.name.slice(0, 18), x + cw / 2, y + ch * 0.26);
    ctx.fillStyle = PALETTE.white;
    ctx.font = `${Math.round(cw * 0.048)}px monospace`;
    wrapText(c.desc ?? '', x + cw / 2, y + ch * 0.46, cw - 28, Math.round(cw * 0.062));
    ctx.fillStyle = PALETTE.cyan;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`[${i + 1}]`, x + cw / 2, y + ch - Math.round(ch * 0.12));
    x += cw + gap;
  }
  ctx.fillStyle = 'rgba(217,200,169,0.7)';
  ctx.font = '13px monospace';
  ctx.fillText('tap a card  (or press 1 / 2 / 3)', W / 2, H / 2 + ch / 2 + 46);
  ctx.textAlign = 'left';
}

function drawResults() {
  const W = canvas.width, H = canvas.height;
  const r = state.results ?? {};
  ctx.fillStyle = 'rgba(10,6,10,0.9)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = r.win ? PALETTE.violet : PALETTE.hp;
  ctx.font = 'bold 56px monospace';
  ctx.fillText(r.win ? 'COLOSSUS SLAIN' : 'YOU DIED', W / 2, H / 2 - 80);
  ctx.fillStyle = PALETTE.white;
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`survived ${formatTime(r.time ?? 0)}`, W / 2, H / 2 - 20);
  ctx.fillStyle = PALETTE.bone;
  ctx.font = '18px monospace';
  ctx.fillText(`kills ${r.kills ?? 0}   ·   level ${r.level ?? 1}   ·   gold ${r.gold ?? 0}`, W / 2, H / 2 + 20);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`score ${r.score ?? 0}`, W / 2, H / 2 + 56);
  ctx.fillStyle = PALETTE.cyan;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('TAP  or  press ENTER  —  run again', W / 2, H / 2 + 120);
  ctx.textAlign = 'left';
}

function wrapText(text, cx, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, cx, yy);
      line = w; yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

export function formatTime(t) {
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function canvasSize() {
  return { w: canvas.width, h: canvas.height };
}

// ---------------------------------------------------------------------------
// SHOP + LEADERBOARD
// Geometry is exported so input.js hit-tests the exact rectangles drawn here.
// ---------------------------------------------------------------------------

const RARITY_COLOR = {
  common: '#d9c8a9', rare: '#4fd6ff', epic: '#b26bff', legendary: '#ffd24a',
};

export function shopRects() {
  const W = canvas.width, H = canvas.height;
  // Grid fills whatever height is available — rows are derived from cardH so
  // 13 heroes never run off a 720px canvas.
  const cols = W < 700 ? 2 : (W < 1000 ? 3 : 4);
  const gap = 10, padX = 24, top = 148, bottom = 40;
  const availH = H - top - bottom;
  const rows = Math.max(2, Math.floor(availH / 92));
  const cardH = Math.floor((availH - gap * (rows - 1)) / rows);
  const cardW = Math.floor((W - padX * 2 - gap * (cols - 1)) / cols);
  const cards = [];
  const slots = cols * rows;
  for (let i = 0; i < slots; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    cards.push({ x: padX + c * (cardW + gap), y: top + r * (cardH + gap),
                 w: cardW, h: cardH, index: i });
  }
  // Tabs size themselves so all four plus REDEEM/CLOSE always fit the width.
  const th = 32, gapT = 6;
  const rightW = 250;                       // REDEEM + CLOSE reserved area
  const avail = W - padX * 2 - rightW;
  const tw = Math.max(74, Math.floor((avail - gapT * 3) / 4));
  const tabs = [
    { id: 'chars',    label: 'HEROES',      x: padX,                    y: 96, w: tw, h: th },
    { id: 'weapons',  label: 'WEAPONS',     x: padX + (tw + gapT),      y: 96, w: tw, h: th },
    { id: 'upgrades', label: 'UPGRADES',    x: padX + (tw + gapT) * 2,  y: 96, w: tw, h: th },
    { id: 'board',    label: 'SCORES',      x: padX + (tw + gapT) * 3,  y: 96, w: tw, h: th },
  ];
  const close  = { x: W - padX - 104,      y: 96, w: 104, h: th };
  const redeem = { x: W - padX - 104 - 8 - 130, y: 96, w: 130, h: th };
  // Pager sits bottom-centre so every item is reachable without scrolling.
  const pgW = 44, pgH = 28;
  const cx = W / 2;
  const prev = { x: cx - pgW - 60, y: H - pgH - 8, w: pgW, h: pgH };
  const next = { x: cx + 60,       y: H - pgH - 8, w: pgW, h: pgH };
  return { cards, tabs, close, redeem, prev, next, cardH, cols, slots: cards.length };
}

export function drawShop(shop, tab, meta, notice) {
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(8,5,8,0.95)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.rust;
  ctx.font = 'bold 26px monospace';
  ctx.fillText('SHOP', 24, 46);

  // Wallet: gold, points, and the conversion rate — the economy is visible.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`${meta.gold ?? 0} GOLD`, W - 24, 34);
  ctx.fillStyle = PALETTE.xp;
  ctx.font = '12px monospace';
  const pts = meta.points ?? 0;
  ctx.fillText(`${pts} PTS  (= ${Math.floor(pts * 0.1)} gold)`, W - 24, 54);
  ctx.textAlign = 'left';

  const R = shopRects();
  for (const t of R.tabs) drawTab(t, t.label, tab === t.id);
  drawButton(R.redeem, 'REDEEM PTS', false);
  drawButton(R.close, 'CLOSE', false);

  const full = tab === 'chars' ? shop.characters
             : tab === 'weapons' ? shop.weapons
             : tab === 'upgrades' ? shop.upgrades : [];
  const per = R.slots;
  const page = state.shopPage ?? 0;
  const pages = Math.max(1, Math.ceil(full.length / per));
  const list = full.slice(page * per, page * per + per);

  if (tab === 'board') { drawLeaderboard(meta); }
  else {
    const owned = tab === 'chars' ? (meta.unlockedChars ?? [])
                : tab === 'weapons' ? (meta.ownedWeapons ?? [])
                : (meta.ownedUpgrades ?? []);
    const isActive = tab === 'chars' ? meta.activeChar : null;

    for (let i = 0; i < list.length; i++) {
      const it = list[i], r = R.cards[i];
      if (!r) break;
      const own = owned.includes(it.id);
      const active = isActive === it.id;
      const col = RARITY_COLOR[it.rarity] ?? PALETTE.stone;

      ctx.fillStyle = 'rgba(20,12,18,0.96)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = active ? PALETTE.cyan : col;
      ctx.lineWidth = active ? 3 : 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      ctx.fillStyle = col;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(it.name, r.x + 9, r.y + 20);
      ctx.fillStyle = 'rgba(217,200,169,0.6)';
      ctx.font = '9px monospace';
      ctx.fillText((it.rarity ?? '').toUpperCase(), r.x + 9, r.y + 33);

      ctx.fillStyle = PALETTE.bone;
      ctx.font = '10px monospace';
      wrapText(it.perk ?? it.desc ?? '', r.x + r.w / 2, r.y + 50, r.w - 18, 12);

      ctx.font = 'bold 11px monospace';
      if (active) { ctx.fillStyle = PALETTE.cyan; ctx.fillText('EQUIPPED', r.x + 9, r.y + r.h - 7); }
      else if (own) { ctx.fillStyle = PALETTE.xp; ctx.fillText(tab === 'chars' ? 'TAP TO EQUIP' : 'OWNED', r.x + 9, r.y + r.h - 7); }
      else {
        const afford = (meta.gold ?? 0) >= it.price;
        ctx.fillStyle = afford ? PALETTE.gold : 'rgba(224,64,90,0.85)';
        ctx.fillText(it.price === 0 ? 'FREE' : `${it.price} GOLD`, r.x + 9, r.y + r.h - 7);
      }
    }
  }

  if (tab !== 'board' && pages > 1) {
    drawButton(R.prev, '<', false);
    drawButton(R.next, '>', false);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.bone;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${page + 1} / ${pages}`, W / 2, H - 18);
    ctx.textAlign = 'left';
  }

  if (notice) {
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ember;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(notice, W / 2, H - 34);
    ctx.textAlign = 'left';
  }
}

function drawTab(r, label, on) {
  ctx.fillStyle = on ? 'rgba(178,107,255,0.28)' : 'rgba(10,6,10,0.8)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = on ? PALETTE.violet : 'rgba(217,200,169,0.4)';
  ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = on ? PALETTE.violet : PALETTE.bone;
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 4);
  ctx.textAlign = 'left';
}

function drawLeaderboard(meta) {
  const W = canvas.width;
  const lb = meta.leaderboard ?? [];
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.bone;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('LOCAL LEADERBOARD', 24, 128);
  if (!lb.length) {
    ctx.fillStyle = 'rgba(217,200,169,0.6)';
    ctx.font = '13px monospace';
    ctx.fillText('No runs recorded yet. Finish a run to place.', 24, 156);
    return;
  }
  ctx.font = '12px monospace';
  const cols = ['#', 'SCORE', 'KILLS', 'TIME', 'LV', 'HERO'];
  const xs = [24, 70, 200, 300, 400, 470];
  ctx.fillStyle = 'rgba(217,200,169,0.55)';
  cols.forEach((c, i) => ctx.fillText(c, xs[i], 154));
  for (let i = 0; i < lb.length; i++) {
    const e = lb[i];
    const y = 176 + i * 20;
    ctx.fillStyle = i === 0 ? PALETTE.gold : PALETTE.bone;
    ctx.fillText(String(i + 1), xs[0], y);
    ctx.fillText(String(e.score), xs[1], y);
    ctx.fillText(String(e.kills), xs[2], y);
    ctx.fillText(formatTime(e.time), xs[3], y);
    ctx.fillText(String(e.level), xs[4], y);
    ctx.fillText(String(e.char ?? ''), xs[5], y);
    if (W < 700) break;   // phone: show fewer rows rather than overflow
  }
}
