// Every route at four widths in both themes, plus the interactive parts.
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { offline, ROUTES, THEMES, WIDTHS } from './helpers';

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`${width}px ${theme}`, () => {
      test.use({ viewport: { width, height: 900 }, colorScheme: theme });
      for (const route of ROUTES) {
        test(`${route}: no overflow, one h1, alt on every image`, async ({ page }) => {
          await offline(page);
          await page.goto(route);
          const r = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            h1: document.querySelectorAll('h1').length,
            noAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.src),
          }));
          expect(r.overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
          expect(r.h1, 'h1 elements').toBe(1);
          expect(r.noAlt, 'images without alt').toEqual([]);
        });
      }
    });
  }
}

test.describe('axe-core, WCAG 2.2 AA', () => {
  for (const theme of THEMES) {
    for (const width of [390, 1440]) {
      test.describe(`${width}px ${theme}`, () => {
        test.use({ viewport: { width, height: 900 }, colorScheme: theme });
        for (const route of ROUTES) {
          test(`${route}: no serious or critical violations`, async ({ page }) => {
            await offline(page);
            await page.goto(route);
            const res = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
              .analyze();
            const bad = res.violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map(
                (v) =>
                  `${v.id} (${v.impact}): ${v.nodes
                    .map((n) => n.target.join(' '))
                    .slice(0, 3)
                    .join(' | ')}`,
              );
            expect(bad).toEqual([]);
          });
        }
      });
    }
  }
});

test.describe('interactive', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the quorum demo cycles 3 → 2 → 1 → reset', async ({ page }) => {
    await offline(page);
    await page.goto('/');
    const q = page.locator('[data-quorum]');
    const modes = () => q.locator('[data-q-mode]').allTextContents();
    await expect(q).toHaveAttribute('data-alive', '3');
    expect(await modes()).toEqual(['Vote', 'Vote']);
    await page.click('[data-q-break]');
    await expect(q).toHaveAttribute('data-alive', '2');
    expect(await modes()).toEqual(['Compare', 'Compare']);
    await page.click('[data-q-break]');
    await expect(q).toHaveAttribute('data-alive', '1');
    expect(await modes()).toEqual(['Stopped', 'Self-check']);
    await expect(page.locator('[data-q-break]')).toBeHidden();
    await page.click('[data-q-reset]');
    await expect(q).toHaveAttribute('data-alive', '3');
  });

  test('the form submits (Worker mocked) and shows the sent card', async ({ page }) => {
    await offline(page);
    let posted = '';
    await page.route('https://api.mru.space/request', async (r) => {
      posted = r.request().postData() ?? '';
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '{"ok":true}',
      });
    });
    await page.goto('/use-cases/ocean-buoys/');
    await page.click('#request button[type=submit]');
    await expect(page.locator('#req-err-email')).toHaveText('Enter your work email, so we can reply.');
    await page.fill('#request input[name=email]', 'ops@example.org');
    await page.click('#request button[type=submit]');
    await expect(page.locator('[data-req-sent]')).toBeVisible();
    expect(posted).toContain('email=ops%40example.org');
    expect(posted).toContain('topic=Ocean+buoys+and+moorings');
    expect(posted).toContain('cf-turnstile-response=test-token');
    await page.click('[data-req-again]');
    await expect(page.locator('[data-req-form]')).toBeVisible();
  });

  test('without JS, the form posts to the Worker and the quorum table shows', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await offline(page);
    await page.goto('/');
    await expect(page.locator('.quorum-fallback')).toBeVisible();
    await expect(page.locator('[data-quorum]')).toBeHidden();
    const form = page.locator('#request form');
    await expect(form).toHaveAttribute('action', 'https://api.mru.space/request');
    await expect(form).toHaveAttribute('method', 'post');
    await ctx.close();
  });

  test('the theme toggle sets, keeps and clears the theme', async ({ page }) => {
    await offline(page);
    await page.goto('/');
    await page.click('[data-theme-set="dark"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.click('[data-theme-set="auto"]');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  });

  test('stable URLs resolve', async ({ request }) => {
    for (const u of [
      '/mru-whitepaper.pdf',
      '/assets/readme/mru-github-dark.gif',
      '/assets/readme/mru-github-light.gif',
      '/favicon.ico',
      '/favicon.svg',
      '/assets/favicon-light.png',
      '/assets/favicon-dark.png',
      '/apple-touch-icon.png',
      '/site.webmanifest',
      '/assets/og-image.png',
      '/assets/mru.gif',
      '/assets/mru-light.gif',
      '/assets/mru.mp4',
      '/assets/mru-light.mp4',
      '/terms/',
      '/CNAME',
      '/.nojekyll',
      '/llms.txt',
      '/llms-full.txt',
      '/robots.txt',
      '/sitemap.xml',
      '/research/feed.xml',
    ])
      expect((await request.get(u)).status(), u).toBe(200);
  });
});
