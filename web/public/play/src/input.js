// Input: keyboard + touch. Normalized axis + edge-triggered actions.
// Touch is REQUIRED — the game must be playable on a phone with no keyboard.

const keys = new Set();
const pressed = new Set();
let canvasEl = null;

// --- virtual (touch) state ---
let stickActive = false;
let stickId = null;
let stickOrigin = { x: 0, y: 0 };
let stickVec = { x: 0, y: 0 };
let touchStart = false;
let touchDash = false;
let touchTapped = { x: 0, y: 0 };
const RADIUS = 52;            // stick throw distance in canvas px

function cssToCanvas(ev) {
  const r = canvasEl.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * (canvasEl.width / r.width),
    y: (ev.clientY - r.top) * (canvasEl.height / r.height),
  };
}

export function initInput(canvas) {
  canvasEl = canvas;

  // --- keyboard ---
  window.addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // --- touch ---
  const onStart = (ev) => {
    ev.preventDefault();
    touchStart = true;              // any touch counts as a "tap" for menus
    for (const t of ev.changedTouches) {
      const p = cssToCanvas(t);
      touchTapped = p;
      // Left half = movement stick. Right half = confirm / dash.
      if (p.x < canvasEl.width * 0.5 && !stickActive) {
        stickActive = true;
        stickId = t.identifier;
        stickOrigin = p;
        stickVec = { x: 0, y: 0 };
      } else {
        touchDash = true;
      }
    }
  };
  const onMove = (ev) => {
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      if (t.identifier !== stickId) continue;
      const p = cssToCanvas(t);
      let dx = p.x - stickOrigin.x;
      let dy = p.y - stickOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
      stickVec = { x: dx / RADIUS, y: dy / RADIUS };
    }
  };
  const onEnd = (ev) => {
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      const p = cssToCanvas(t);
      // Short touch that did not drag = a tap. Feed it to the click subscribers
      // so menu / HUD buttons work with a finger.
      const soft = t.identifier !== stickId || Math.hypot(stickVec.x, stickVec.y) < 0.35;
      if (soft) emitClick(p);
      if (t.identifier === stickId) {
        stickActive = false; stickId = null; stickVec = { x: 0, y: 0 };
      }
    }
  };
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd, { passive: false });
  canvas.addEventListener('touchcancel', onEnd, { passive: false });

  // --- mouse (desktop menus) ---
  canvas.addEventListener('mousedown', (ev) => {
    touchTapped = cssToCanvas(ev);
    touchStart = true;
  });
}

export function readInput() {
  const l = keys.has('KeyA') || keys.has('ArrowLeft');
  const r = keys.has('KeyD') || keys.has('ArrowRight');
  const u = keys.has('KeyW') || keys.has('ArrowUp');
  const d = keys.has('KeyS') || keys.has('ArrowDown');
  let ax = (r ? 1 : 0) - (l ? 1 : 0);
  let ay = (d ? 1 : 0) - (u ? 1 : 0);
  if (ax === 0 && ay === 0 && stickActive) {
    const m = Math.hypot(stickVec.x, stickVec.y);
    if (m > 0.18) { ax = stickVec.x / m; ay = stickVec.y / m; }
  }
  return { ax, ay, dashPressed: pressed.has('Space') || touchDash };
}

export function pressedOnce(code) { return pressed.has(code); }

/** True once per tap anywhere on the canvas. Lets menus work with no keyboard. */
export function tappedOnce() {
  if (!touchStart) return false;
  touchStart = false;
  return true;
}

export function tapPoint() { return touchTapped; }

export function endFrame() {
  pressed.clear();
  touchDash = false;
}

// Click subscribers. Touch dispatches into this same list, because a browser
// `click` event after preventDefault() on touchstart is unreliable on phones —
// that is why the on-screen AI / SETTINGS buttons were dead to the touch.
const clickSubs = [];

function emitClick(canvasPt) {
  const ev = { offsetX: canvasPt.x, offsetY: canvasPt.y, preventDefault() {} };
  for (const fn of clickSubs) {
    try { fn(ev); } catch (e) { console.error('click handler', e); }
  }
}

export function onCanvasClick(fn) {
  clickSubs.push(fn);
  if (canvasEl && clickSubs.length === 1) {
    // Desktop still uses the native click event.
    canvasEl.addEventListener('click', (e) => emitClick(cssToCanvas(e)));
  }
}

/** Virtual stick geometry, for the renderer to draw on touch devices. */
export function stickState() {
  return { active: stickActive, origin: stickOrigin, vec: stickVec, radius: RADIUS };
}
