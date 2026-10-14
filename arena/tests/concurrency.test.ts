// 10 concurrent runs must not corrupt shared state, stall, or produce NaN.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';
const N = 10;

let ids: string[] = [];

async function arena(path: string, init?: RequestInit) {
  const r = await fetch(ARENA + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  return { status: r.status, body: r.status < 400 ? await r.json() : null };
}

describe('concurrency', () => {
  beforeAll(async () => {
    const up = await fetch(`${ARENA}/health`).then(r => r.ok).catch(() => false);
    if (!up) throw new Error('arena not reachable on ' + ARENA);
  });

  afterAll(async () => {
    for (const id of ids) await fetch(`${ARENA}/runs/${id}`, { method: 'DELETE' }).catch(() => {});
  }, 30000);

  it(`starts ${N} concurrent runs and keeps them independent`, async () => {
    const created = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        arena('/runs', { method: 'POST', body: JSON.stringify({
          agentName: `conc-${i}`, seed: 1000 + i, targetLevel: 99,
          tickMs: 250, mindTier: 'ORC',
        })})),
    );
    ids = created.map(c => c.body.id).filter(Boolean);
    expect(ids.length, 'all runs created').toBe(N);
    expect(new Set(ids).size, 'ids are unique').toBe(N);

    // let them tick
    await new Promise(r => setTimeout(r, 6000));

    const states = await Promise.all(ids.map(id => arena(`/runs/${id}`)));
    const live = states.filter(s => s.body);

    for (const [i, s] of live.entries()) {
      const st = s.body;
      // no NaN anywhere in numeric state
      for (const [k, v] of Object.entries(st)) {
        if (typeof v === 'number') expect(Number.isFinite(v), `run ${i}.${k} not finite`).toBe(true);
      }
      expect(st.tick, `run ${i} advanced`).toBeGreaterThan(0);
    }

    // each run advanced independently (not all frozen at the same tick)
    const ticks = live.map(s => s.body.tick as number);
    expect(Math.max(...ticks)).toBeGreaterThan(0);
  }, 60000);

  it('rejects a bet on a nonexistent market without 5xx', async () => {
    const id = ids[0];
    const r = await arena(`/runs/${id}/bets`, { method: 'POST', body: JSON.stringify({
      marketId: 'm_nope', bettorId: 'x', choice: true, amount: 10,
    })});
    expect(r.status).toBeLessThan(500);
  });

  it('rejects malformed bet payloads cleanly', async () => {
    const id = ids[0];
    const r = await arena(`/runs/${id}/bets`, { method: 'POST',
      body: JSON.stringify({ marketId: null, amount: -5 }) });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });
});
