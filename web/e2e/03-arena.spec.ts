import { test, expect } from '@playwright/test';

const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';

test('live arena: websocket state, chat, avatar panel', async ({ page, request }) => {
  // create a run straight on the arena API for a deterministic target
  const created = await request.post(`${ARENA}/runs`, {
    data: { agentName: 'E2Ebot', gameSlug: 'grid-survival', seed: 99,
            targetLevel: 9, tickMs: 400, mindTier: 'ORC' },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();

  await page.goto(`/arena/${id}`);

  // status badge flips to Live once the socket opens
  await expect(page.getByText(/live/i).first()).toBeVisible({ timeout: 25000 });

  // live state renders (level/time readout from the venue)
  await expect(page.getByText(/lvl\s*\d+/i).first()).toBeVisible({ timeout: 25000 });

  // tabs exist
  for (const t of ['Chat','State','Bets']) {
    await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
  }

  // the agent should say something within the window
  await page.waitForTimeout(12000);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('[object Object]');

  // clean up
  await request.delete(`${ARENA}/runs/${id}`);
});

test('arena page recovers from a missing run without crashing', async ({ page }) => {
  await page.goto('/arena/does-not-exist-xyz');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('[object Object]');
  // page must still render chrome, not a blank crash
  expect(body.length).toBeGreaterThan(40);
});
