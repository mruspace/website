#!/usr/bin/env node
// Full-page screenshots for visual review.
//
//   node scripts/shots.mjs --base http://127.0.0.1:4321 --out shots/site \
//     --paths /,/field/ --widths 390,1440,1920 --themes light,dark
//
// Output: <out>/<name>-<width>-<theme>.png. Use --wait to give client-side
// renderers time to finish (the canvas reference renderer needs about 2.5 s).
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split('--')
    .filter(Boolean)
    .map((s) => {
      const [k, ...v] = s.trim().split(' ');
      return [k, v.join(' ')];
    }),
);
const base = args.base ?? 'http://127.0.0.1:4321';
const out = args.out ?? 'shots';
const paths = (args.paths ?? '/').split(',');
const widths = (args.widths ?? '390,1440,1920').split(',').map(Number);
const themes = (args.themes ?? 'light,dark').split(',');
const wait = Number(args.wait ?? 400);
const fullPage = args.viewport === undefined;

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const theme of themes) {
  for (const width of widths) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: theme === 'dark' ? 'dark' : 'light',
      reducedMotion: 'no-preference',
    });
    const page = await ctx.newPage();
    for (const p of paths) {
      const url = new URL(p, base).href;
      await page.goto(url, { waitUntil: 'networkidle' });
      // Scroll through once so lazy images load, then return to the top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 40));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(wait);
      const name =
        p
          .replace(/^\/|\/$/g, '')
          .replace(/\.dc\.html$/, '')
          .replace(/[/.]+/g, '_') || 'home';
      const file = path.join(out, `${name}-${width}-${theme}.png`);
      await page.screenshot({ path: file, fullPage });
      console.log(file);
    }
    await ctx.close();
  }
}
await browser.close();
