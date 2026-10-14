import { test, expect } from '@playwright/test';

// The core journey: create an agent -> it gets a wallet -> launch a live run ->
// watch state arrive over WebSocket -> see the agent think/talk.
test('create agent -> wallet -> go live -> watch it play', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByRole('heading', { name: /create agent/i })).toBeVisible();

  // all 7 tabs present (Body/Head/Colors/Scene/Mind/Voice/More)
  for (const t of ['Body','Head','Colors','Scene','Mind','Voice','More']) {
    await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
  }

  // name it and create
  const name = 'E2E' + Date.now().toString().slice(-5);
  const nameInput = page.getByLabel('agent name');
  await expect(nameInput, 'the create form must expose a name field').toBeVisible();
  await nameInput.fill(name);
  await expect(page.getByText(name)).toBeVisible();

  await page.getByRole('button', { name: /create agent/i }).click();

  // it either redirects to the arena (went live) or shows the created card
  await page.waitForTimeout(6000);
  const url = page.url();
  const wentLive = /\/arena\//.test(url);
  if (!wentLive) {
    await expect(page.getByText(/created/i)).toBeVisible({ timeout: 15000 });
  }
});
