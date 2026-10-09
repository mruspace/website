#!/usr/bin/env node
// Compare built pages with the canvas reference renders.
//
//   node scripts/compare.mjs --pairs pairs.json --out shots/cmp [--only home]
//
// pairs.json: [{ "name": "home", "site": "/", "ref": "Home" }, ...]
// The canvas is served locally (see README, "Visual review"); --ref-base
// points at it. Each pair is captured at 390, 1440 and 1920 px, light and
// dark. Output: side-by-side PNGs and summary.json with the height
// difference, the share of differing pixels and the first element whose
// position or size differs.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const pairs = JSON.parse(await readFile(opt('pairs', 'scripts/pairs.json'), 'utf8'));
const out = opt('out', 'shots/cmp');
const siteBase = opt('site-base', 'http://127.0.0.1:4321');
const refBase = opt('ref-base', 'http://127.0.0.1:8765/project/');
const only = opt('only', '');
const widths = opt('widths', '390,1440,1920').split(',').map(Number);
const themes = opt('themes', 'light,dark').split(',');
await mkdir(out, { recursive: true });

const SEL = 'h1, h2, h3, .seam, figure, .stat, table, .card, .tile, .quorum, .faq, form, footer, header';

// Known canvas bug, fixed on the site: the quorum cell's stray "mru" class gives
// it the page wrapper's min-height. Neutralise it in the reference too.
const REF_FIX = '.qcell.mru{min-height:0!important}';

async function capture(page, url, wait, file, fix = '') {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(wait);
  // Freeze the animated mark on its first frame so it does not count as a difference.
  await page.addStyleTag({
    content: '.mark-anim img{visibility:hidden!important}.beacon .b{animation:none!important}' + fix,
  });
  const boxes = await page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)]
      .filter((e) => e.getBoundingClientRect().height > 0)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          tag: e.tagName.toLowerCase(),
          text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
          y: Math.round(r.top + scrollY),
          x: Math.round(r.left),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      });
  }, SEL);
  await page.screenshot({ path: file, fullPage: true });
  return boxes;
}

const browser = await chromium.launch();
const summary = [];
for (const pair of pairs) {
  if (only && !only.split(',').includes(pair.name)) continue;
  for (const theme of themes) {
    for (const width of widths) {
      const tag = `${pair.name}-${width}-${theme}`;
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await ctx.newPage();
      // Third parties are off in local checks: Turnstile only works on mru.space,
      // and analytics must not count test runs.
      await ctx.route(/challenges\.cloudflare\.com|googletagmanager\.com|google-analytics\.com/, (r) => r.abort());
      const refUrl = new URL(`_R_${pair.ref}_${theme}.dc.html`, refBase).href;
      const ra = path.join(out, `${tag}-ref.png`);
      const sa = path.join(out, `${tag}-site.png`);
      const rb = await capture(page, refUrl, 2500, ra, REF_FIX);
      const sb = await capture(page, new URL(pair.site, siteBase).href, 300, sa);
      await ctx.close();
      let first = null;
      for (let i = 0; i < Math.min(rb.length, sb.length); i++) {
        const a = rb[i];
        const b = sb[i];
        if (Math.abs(a.y - b.y) > 2 || Math.abs(a.h - b.h) > 2 || Math.abs(a.w - b.w) > 2 || a.tag !== b.tag) {
          first = { i, ref: a, site: b };
          break;
        }
      }
      const dims = (f) => execFileSync('magick', ['identify', '-format', '%h', f]).toString();
      let ae = null;
      try {
        execFileSync('magick', ['compare', '-metric', 'AE', '-fuzz', '3%', ra, sa, 'null:'], { stdio: 'pipe' });
        ae = 0;
      } catch (e) {
        ae = Number(String(e.stderr).match(/\(([\d.e-]+)\)/)?.[1] ?? NaN);
      }
      const rh = Number(dims(ra));
      const sh = Number(dims(sa));
      execFileSync('magick', [
        ra,
        sa,
        '-background',
        '#d8d8d4',
        '-splice',
        '16x0',
        '+append',
        '-resize',
        width > 1000 ? '40%' : '80%',
        path.join(out, `${tag}-side.png`),
      ]);
      const row = { tag, refH: rh, siteH: sh, dH: sh - rh, diff: ae, counts: [rb.length, sb.length], first };
      summary.push(row);
      console.log(
        `${tag.padEnd(34)} dH=${String(sh - rh).padStart(5)} diff=${ae === null ? '?' : (ae * 100).toFixed(2) + '%'} ${first ? `first: #${first.i} ${first.ref.tag} "${first.ref.text}" y${first.ref.y}/${first.site.y} h${first.ref.h}/${first.site.h} w${first.ref.w}/${first.site.w}` : 'layout match'}`,
      );
    }
  }
}
await browser.close();
await writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
