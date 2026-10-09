import type { BrowserContext, Page } from '@playwright/test';
import metadata from '../src/data/metadata.json' with { type: 'json' };

/** Every route the site builds, from metadata.json, plus the 404 page. */
export const ROUTES: string[] = metadata
  .map((m) => new URL(m.url).pathname)
  .map((p) => (p === '/404/' ? '/404.html' : p));

export const WIDTHS = [390, 768, 1440, 1920];
export const THEMES = ['light', 'dark'] as const;

/**
 * Third parties are off in tests: analytics must not count test runs, and
 * Turnstile is replaced by a stub that passes at once.
 */
export async function offline(ctx: BrowserContext | Page): Promise<void> {
  await ctx.route(/googletagmanager\.com|google-analytics\.com|madruga\.dev/, (r) => r.abort());
  await ctx.route(/challenges\.cloudflare\.com\/turnstile/, (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `window.turnstile = {
        render(el, o) { const i = document.createElement('input'); i.type = 'hidden'; i.name = 'cf-turnstile-response'; i.value = 'test-token'; el.append(i); setTimeout(() => o.callback('test-token')); return 'w1'; },
        reset() {},
      };
      const s = new URL(document.currentScript.src).searchParams.get('onload'); if (s && window[s]) window[s]();`,
    }),
  );
}
