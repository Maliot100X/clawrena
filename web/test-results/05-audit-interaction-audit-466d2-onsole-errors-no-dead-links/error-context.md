# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-audit.spec.ts >> interaction audit >> every page: no failed requests, no console errors, no dead links
- Location: e2e/05-audit.spec.ts:7:7

# Error details

```
Error: Channel closed
```

```
Error: locator.all: Target page, context or browser has been closed
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const ARENA = process.env.ARENA_HTTP ?? 'http://localhost:4100';
  4  | 
  5  | // Click EVERY interactive element on every page. Any 404/500/console error fails.
  6  | test.describe('interaction audit', () => {
  7  |   test('every page: no failed requests, no console errors, no dead links', async ({ page, request }) => {
  8  |     const problems: string[] = [];
  9  |     page.on('response', r => {
  10 |       if (r.status() >= 400 && !r.url().includes('favicon')) problems.push(`${r.status()} ${r.url()}`);
  11 |     });
  12 |     page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  13 |     page.on('requestfailed', r => {
  14 |       const u = r.url();
  15 |       // Next.js aborts RSC prefetch requests on completion — that is normal, not a bug
  16 |       if (r.failure()?.errorText === 'net::ERR_ABORTED' && u.includes('_rsc=')) return;
  17 |       problems.push(`failed: ${u}`);
  18 |     });
  19 | 
  20 |     const pages = ['/', '/g', '/predict', '/build', '/leaderboard', '/design', '/login'];
  21 |     for (const p of pages) {
  22 |       await page.goto(p, { waitUntil: 'domcontentloaded' });
  23 |       await page.waitForLoadState('networkidle').catch(() => {});
  24 |       // click every button/link that stays on-site and is visible
> 25 |       const els = await page.locator('a[href^="/"], button').all();
     |                                                              ^ Error: locator.all: Target page, context or browser has been closed
  26 |       for (const el of els.slice(0, 25)) {
  27 |         if (!(await el.isVisible().catch(() => false))) continue;
  28 |         if (await el.isDisabled().catch(() => false)) continue;
  29 |         const href = await el.getAttribute('href').catch(() => null);
  30 |         if (href && (href.startsWith('/api') || href === p)) continue;
  31 |         await el.click({ timeout: 4000, noWaitAfter: true }).catch(() => {});
  32 |         await page.waitForTimeout(120);
  33 |         if (page.url() !== 'about:blank' && !page.url().startsWith('http://localhost:3200')) break;
  34 |         if (page.url() !== `http://localhost:3200${p}` && !page.url().includes(p)) {
  35 |           await page.goBack({ timeout: 5000 }).catch(() => {});
  36 |         }
  37 |       }
  38 |     }
  39 |     expect(problems, `problems:\n${problems.join('\n')}`).toHaveLength(0);
  40 |   });
  41 | 
  42 |   test('every game page renders and its nav works', async ({ page }) => {
  43 |     const slugs = ['survivors-s2','backrooms','slots','grid-survival','freebots',
  44 |                    'meme-kart','byte-news','pixel-racer'];
  45 |     for (const s of slugs) {
  46 |       const r = await page.goto(`/g/${s}`, { waitUntil: 'domcontentloaded' });
  47 |       expect(r?.status(), `/g/${s}`).toBeLessThan(400);
  48 |       // wait for the real content, not the loading boundary
  49 |       await expect(page.getByText(s === 'grid-survival' ? 'Grid Survival' : /.+/)
  50 |         .first()).toBeVisible({ timeout: 20000 });
  51 |       await page.waitForFunction(() => !document.body.innerText.includes('Loading arena'),
  52 |         null, { timeout: 20000 }).catch(() => {});
  53 |       const txt = await page.locator('body').innerText();
  54 |       expect(txt, `/g/${s} blank`).not.toContain('[object Object]');
  55 |       expect(txt.length, `/g/${s} too short`).toBeGreaterThan(60);
  56 |     }
  57 |   });
  58 | 
  59 |   test('every agent profile renders', async ({ page, request }) => {
  60 |     const r = await request.get('http://localhost:3200/api/agents');
  61 |     const { agents } = await r.json();
  62 |     expect(agents.length).toBeGreaterThan(0);
  63 |     for (const a of agents.slice(0, 6)) {
  64 |       const resp = await page.goto(`/a/${a.handle}`, { waitUntil: 'domcontentloaded' });
  65 |       expect(resp?.status(), `/a/${a.handle}`).toBeLessThan(400);
  66 |       await page.waitForFunction(() => !document.body.innerText.includes('Loading arena'),
  67 |         null, { timeout: 20000 }).catch(() => {});
  68 |       expect(await page.locator('body').innerText()).toContain(a.name);
  69 |     }
  70 |   });
  71 | 
  72 |   test('leaderboard rows link to working replays', async ({ page, request }) => {
  73 |     await page.goto('/leaderboard');
  74 |     const links = await page.locator('a[href^="/replay/"]').all();
  75 |     for (const l of links.slice(0, 5)) {
  76 |       const href = await l.getAttribute('href');
  77 |       const resp = await request.get('http://localhost:3200' + href);
  78 |       expect(resp.status(), href!).toBeLessThan(400);
  79 |     }
  80 |   });
  81 | 
  82 |   test('nav is consistent across every page', async ({ page }) => {
  83 |     for (const p of ['/', '/g', '/predict', '/build', '/leaderboard', '/design']) {
  84 |       await page.goto(p);
  85 |       for (const label of ['Live','Predict','Games','Build','Board']) {
  86 |         await expect(page.getByRole('link', { name: label, exact: true }).first(),
  87 |           `nav "${label}" missing on ${p}`).toBeVisible();
  88 |       }
  89 |     }
  90 |   });
  91 | });
  92 | 
```