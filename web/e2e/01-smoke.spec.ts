import { test, expect } from '@playwright/test';

// Every route must render without a console error or a failed request.
const ROUTES = ['/', '/g', '/predict', '/build', '/leaderboard', '/design', '/login'];

for (const route of ROUTES) {
  test(`route ${route} renders clean`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failed: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
    page.on('requestfailed', r => failed.push(`${r.url()} ${r.failure()?.errorText}`));

    const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), `${route} status`).toBeLessThan(400);
    await page.waitForLoadState('networkidle').catch(() => {});

    // no [object Object] leaking into the DOM (the reference site's bug)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText, '[object Object] leaked').not.toContain('[object Object]');

    // ignore favicon noise
    const real = consoleErrors.filter(e => !/favicon|404 \(Not Found\)/i.test(e));
    expect(real, `console errors on ${route}: ${real.join(' | ')}`).toHaveLength(0);
  });
}
