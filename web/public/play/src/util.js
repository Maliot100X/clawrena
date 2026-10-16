// Pure math helpers. No state, no side effects.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
export const randInt = (n) => Math.floor(Math.random() * n);
export const pick = (arr) => arr[randInt(arr.length)];
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

// Circle-vs-circle overlap — the only collision shape this genre needs.
export const circleHit = (a, b) => {
  const r = (a.radius ?? 0) + (b.radius ?? 0);
  return dist2(a.x, a.y, b.x, b.y) <= r * r;
};

// XP curve: ceil(10 * n^1.5), matching data/level-curve.json.
export const xpForLevel = (n) => Math.ceil(10 * Math.pow(n, 1.5));

export function shuffle(a) {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
