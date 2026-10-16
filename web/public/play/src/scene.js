// Scene loader and draw dispatcher. Reads level JSON from data/, pre-loads
// every referenced sprite, hands the rendered scene to render.js. Add new
// state per-scene (entities, timers) as your game grows; keep IO + data
// shaping here.

import { loadJSON, loadImage } from './assets.js';
import { fitCanvas, drawBackground, drawProps } from './render.js';

let levelsManifest = null;
const cache = {};      // { sceneId: levelData }
const images = {};     // { 'assets/.../x.png': HTMLImageElement }
let current = null;
let bg = null;

export async function loadLevels() {
  levelsManifest = await loadJSON('data/levels.json');
  return levelsManifest;
}

export async function switchScene(id) {
  const entry = levelsManifest?.levels?.find((l) => l.id === id);
  if (!entry) throw new Error('unknown scene id: ' + id);
  if (!cache[id]) cache[id] = await loadJSON(entry.file);
  current = cache[id];

  fitCanvas(current);

  // Pre-load this scene's background + every prop sprite.
  bg = current.background ? await safeImage(current.background) : null;
  await Promise.all(
    (current.props ?? []).map(async (p) => {
      if (p.image && !images[p.image]) images[p.image] = await safeImage(p.image);
    }),
  );
}

async function safeImage(src) {
  try { return await loadImage(src); } catch (e) { console.warn(e); return null; }
}

export function getCurrentScene() { return current; }
export function getImage(src) { return images[src]; }

export function drawCurrent(_now) {
  if (!current) return;
  drawBackground(bg);
  drawProps(current.props ?? [], (src) => images[src]);
}
