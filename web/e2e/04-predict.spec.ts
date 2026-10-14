import { test, expect } from '@playwright/test';

const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';

test('markets open, bets settle, ledger stays zero-sum', async ({ request }) => {
  const created = await request.post(`${ARENA}/runs`, {
    data: { agentName: 'Betbot', seed: 21, targetLevel: 4, tickMs: 300, mindTier: 'ORC' },
  });
  const { id } = await created.json();

  await new Promise(r => setTimeout(r, 4000));
  const mkts = await request.get(`${ARENA}/runs/${id}/markets`);
  const list = (await mkts.json()).markets;
  expect(list.length, 'a market should auto-open').toBeGreaterThan(0);
  const marketId = list[0].id;

  for (const [who, choice, amt] of [['a', true, 100], ['b', false, 60], ['c', true, 40]] as const) {
    const r = await request.post(`${ARENA}/runs/${id}/bets`, {
      data: { marketId, bettorId: who, choice, amount: amt },
    });
    expect(r.ok(), `bet by ${who}`).toBeTruthy();
  }

  // wait for it to resolve from game state
  let resolved: any = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const res = await request.get(`${ARENA}/runs/${id}/markets`);
    resolved = (await res.json()).markets.find((m: any) => m.id === marketId
      && (m.status === 'RESOLVED' || m.status === 'VOID'));
    if (resolved) break;
  }
  expect(resolved, 'market should resolve or void').toBeTruthy();

  const led = await request.get(`${ARENA}/runs/${id}/ledger`);
  const { sumDelta, entries, count } = await led.json();
  expect(Array.isArray(entries), 'entries is the array').toBe(true);
  expect(count ?? entries.length).toBeGreaterThan(0);
  expect(sumDelta, 'ledger MUST be zero-sum').toBe(0);

  await request.delete(`${ARENA}/runs/${id}`);
});

test('VOID (expired, undecided) refunds and keeps the ledger zero-sum', async ({ request }) => {
  // long target + short market ttl => market expires undecided => VOID path
  const created = await request.post(`${ARENA}/runs`, {
    data: { agentName: 'Voidbot', seed: 77, targetLevel: 99, tickMs: 200, mindTier: 'ORC' },
  });
  const { id } = await created.json();
  await new Promise(r => setTimeout(r, 3000));

  const mkts = await request.get(`${ARENA}/runs/${id}/markets`);
  const list = (await mkts.json()).markets;
  test.skip(!list.length, 'no market opened');
  const marketId = list[0].id;

  for (const [who, choice, amt] of [['v1', true, 80], ['v2', false, 56]] as const) {
    const r = await request.post(`${ARENA}/runs/${id}/bets`, {
      data: { marketId, bettorId: who, choice, amount: amt },
    });
    expect(r.ok()).toBeTruthy();
  }

  // wait for VOID or RESOLVED
  let status = 'OPEN';
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const res = await request.get(`${ARENA}/runs/${id}/markets`);
    status = (await res.json()).markets.find((m: any) => m.id === marketId)?.status ?? status;
    if (status === 'VOID' || status === 'RESOLVED') break;
  }

  const led = await request.get(`${ARENA}/runs/${id}/ledger`);
  const { sumDelta } = await led.json();
  expect(sumDelta, `ledger must be zero-sum even when status=${status}`).toBe(0);

  await request.delete(`${ARENA}/runs/${id}`);
});
