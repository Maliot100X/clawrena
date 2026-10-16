// Object pool. MANDATORY for enemies/projectiles/pickups/particles —
// never `new` in the hot loop (GC stutter kills frame rate at 300 enemies).

export function createPool(factory, reset, initial = 64) {
  const free = [];
  const live = [];
  for (let i = 0; i < initial; i++) free.push(factory());
  return {
    live,
    get() {
      const o = free.pop() ?? factory();
      reset(o);
      live.push(o);
      return o;
    },
    release(o) {
      const i = live.indexOf(o);
      if (i >= 0) live.splice(i, 1);
      free.push(o);
    },
    // Swap-remove dead entries in one pass. Call once per frame.
    sweep(isDead) {
      for (let i = live.length - 1; i >= 0; i--) {
        if (isDead(live[i])) {
          free.push(live[i]);
          live[i] = live[live.length - 1];
          live.pop();
        }
      }
    },
    get freeCount() { return free.length; },
  };
}
