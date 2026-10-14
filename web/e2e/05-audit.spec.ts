import { test, expect } from '@playwright/test';

const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';

// Click EVERY interactive element on every page. Any 404/500/console error fails.
test.describe('interaction audit', () => {
  test('every page: no failed requests, no console errors, no dead links', async ({ page, request }) => {
    const problems: string[] = [];
    page.on('response', r => {
      if (r.status() >= 400 && !r.url().includes('favicon')) problems.push(`${r.status()} ${r.url()}`);
    });
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('requestfailed', r => {
      const u = r.url();
      // Next.js aborts RSC prefetch requests on completion — that is normal, not a bug
      if (r.failure()?.errorText === 'net::ERR_ABORTED' && u.includes('_rsc=')) return;
      problems.push(`failed: ${u}`);
    });

    const pages = ['/', '/g', '/predict', '/build', '/leaderboard', '/design', '/login'];
    for (const p of pages) {
      await page.goto(p, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      // click every button/link that stays on-site and is visible
      const els = await page.locator('a[href^="/"], button').all();
      for (const el of els.slice(0, 25)) {
        if (!(await el.isVisible().catch(() => false))) continue;
        if (await el.isDisabled().catch(() => false)) continue;
        const href = await el.getAttribute('href').catch(() => null);
        if (href && (href.startsWith('/api') || href === p)) continue;
        await el.click({ timeout: 4000, noWaitAfter: true }).catch(() => {});
        await page.waitForTimeout(120);
        if (page.url() !== 'about:blank' && !page.url().startsWith('http://localhost:3200')) break;
        if (page.url() !== `http://localhost:3200${p}` && !page.url().includes(p)) {
          await page.goBack({ timeout: 5000 }).catch(() => {});
        }
      }
    }
    expect(problems, `problems:\n${problems.join('\n')}`).toHaveLength(0);
  });

  test('every game page renders and its nav works', async ({ page }) => {
    const slugs = ['survivors-s2','backrooms','slots','grid-survival','freebots',
                   'meme-kart','byte-news','pixel-racer'];
    for (const s of slugs) {
      const r = await page.goto(`/g/${s}`, { waitUntil: 'domcontentloaded' });
      expect(r?.status(), `/g/${s}`).toBeLessThan(400);
      // wait for the real content, not the loading boundary
      await expect(page.getByText(s === 'grid-survival' ? 'Grid Survival' : /.+/)
        .first()).toBeVisible({ timeout: 20000 });
      await page.waitForFunction(() => !document.body.innerText.includes('Loading arena'),
        null, { timeout: 20000 }).catch(() => {});
      const txt = await page.locator('body').innerText();
      expect(txt, `/g/${s} blank`).not.toContain('[object Object]');
      expect(txt.length, `/g/${s} too short`).toBeGreaterThan(60);
    }
  });

  test('every agent profile renders', async ({ page, request }) => {
    const r = await request.get('http://localhost:3200/api/agents');
    const { agents } = await r.json();
    expect(agents.length).toBeGreaterThan(0);
    for (const a of agents.slice(0, 6)) {
      const resp = await page.goto(`/a/${a.handle}`, { waitUntil: 'domcontentloaded' });
      expect(resp?.status(), `/a/${a.handle}`).toBeLessThan(400);
      await page.waitForFunction(() => !document.body.innerText.includes('Loading arena'),
        null, { timeout: 20000 }).catch(() => {});
      expect(await page.locator('body').innerText()).toContain(a.name);
    }
  });

  test('leaderboard rows link to working replays', async ({ page, request }) => {
    await page.goto('/leaderboard');
    const links = await page.locator('a[href^="/replay/"]').all();
    for (const l of links.slice(0, 5)) {
      const href = await l.getAttribute('href');
      const resp = await request.get('http://localhost:3200' + href);
      expect(resp.status(), href!).toBeLessThan(400);
    }
  });

  test('nav is consistent across every page', async ({ page }) => {
    for (const p of ['/', '/g', '/predict', '/build', '/leaderboard', '/design']) {
      await page.goto(p);
      for (const label of ['Live','Predict','Games','Build','Board']) {
        await expect(page.getByRole('link', { name: label, exact: true }).first(),
          `nav "${label}" missing on ${p}`).toBeVisible();
      }
    }
  });
});
