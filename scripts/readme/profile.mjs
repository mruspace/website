#!/usr/bin/env node
// The github.com/mruspace profile card: four PNGs (wide and narrow, light and
// dark) drawn from profile.json with the site fonts. The org README in
// mruspace/.github shows them from public/assets/readme/.
//
//   npm run readme          draw the PNGs and update profile.sha256
//   npm run check:readme    fail if profile.json or this script changed
//                           without a redraw, or if a public mruspace repo
//                           is neither in "repos" nor in "skip"
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, 'public/assets/readme');
const stampFile = path.join(here, 'profile.sha256');

const data = JSON.parse(await readFile(path.join(here, 'profile.json'), 'utf8'));
const stamp = createHash('sha256')
  .update(await readFile(path.join(here, 'profile.json')))
  .update(await readFile(fileURLToPath(import.meta.url)))
  .digest('hex');

if (process.argv.includes('--check')) {
  let failed = false;
  const saved = (await readFile(stampFile, 'utf8').catch(() => '')).trim();
  if (saved !== stamp) {
    console.error('check:readme: profile.json or profile.mjs changed. Run npm run readme and commit the PNGs.');
    failed = true;
  }
  const repos = await publicRepos();
  if (repos) {
    const known = new Set([...data.repos.map((r) => r.name), ...data.skip]);
    const missing = repos.filter((r) => !known.has(r));
    const gone = data.repos.map((r) => r.name).filter((r) => !repos.includes(r));
    if (missing.length) {
      console.error(
        `check:readme: public repos not on the card: ${missing.join(', ')}. Add each to "repos" or "skip".`,
      );
      failed = true;
    }
    if (gone.length) {
      console.error(`check:readme: repos on the card that are not public: ${gone.join(', ')}.`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  console.log('check:readme: ok');
  process.exit(0);
}

async function publicRepos() {
  const headers = { accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch('https://api.github.com/orgs/mruspace/repos?type=public&per_page=100', { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).map((r) => r.name);
  } catch (err) {
    if (process.env.CI) throw err;
    console.warn(`check:readme: skipped the repo list (${err.message}).`);
    return null;
  }
}

const colors = {
  light: { ink: '#16161a', soft: '#44444c', faint: '#6f6f78', paper: '#fafaf8', rule: '#e3e3dd', signal: '#87650a' },
  dark: { ink: '#ecece8', soft: '#c0c0bc', faint: '#8f8f8a', paper: '#121214', rule: '#2a2a2e', signal: '#d8a54a' },
};

const fonts = [
  ['Jost', 500, 'normal', 'jost-500.woff2'],
  ['Source Serif 4', 400, 'normal', 'source-serif-4-400.woff2'],
  ['IBM Plex Mono', 400, 'normal', 'ibm-plex-mono-400.woff2'],
  ['IBM Plex Mono', 500, 'normal', 'ibm-plex-mono-500.woff2'],
];
let fontCss = '';
for (const [family, weight, style, file] of fonts) {
  const b64 = (await readFile(path.join(root, 'public/fonts', file))).toString('base64');
  fontCss += `@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${b64}) format('woff2')}\n`;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(theme, narrow) {
  const c = colors[theme];
  const repos = data.repos
    .map(
      (r) => `<div class="repo"><span class="name">${esc(r.name)}</span><span class="desc">${esc(r.desc)}</span></div>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${fontCss}
html,body{margin:0;background:transparent}
.card{width:${narrow ? 340 : 880}px;box-sizing:border-box;padding:${narrow ? '30px 24px 26px' : '48px 48px 36px'};
  background:${c.paper};color:${c.ink};border-radius:12px;font-family:'Source Serif 4',Georgia,serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.cols{display:grid;grid-template-columns:${narrow ? 'minmax(0,1fr)' : '1.12fr 1fr'};column-gap:56px;row-gap:40px;align-items:start}
h1{margin:0;font-family:Jost,sans-serif;font-weight:500;font-size:${narrow ? 28 : 34}px;line-height:1.12;letter-spacing:-0.005em}
p{margin:0}
.lead p{font-size:16.5px;line-height:1.62;color:${c.soft};margin-top:14px}
.lead h1+p{margin-top:22px}
.status{margin-top:28px;padding-top:18px;border-top:1px solid ${c.rule}}
.label{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:8px}
.status .label{color:${c.signal}}
.status p{font-size:15px;line-height:1.6;color:${c.soft}}
.repos .label{color:${c.faint};margin-bottom:6px}
.repo{padding:13px 0 14px;border-bottom:1px solid ${c.rule};display:flex;flex-direction:column;gap:3px}
.name{font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:500}
.desc{font-size:15px;line-height:1.5;color:${c.soft}}
.foot{margin-top:${narrow ? 24 : 36}px;padding-top:20px;border-top:${narrow ? '0' : `1px solid ${c.rule}`};display:flex;flex-direction:${narrow ? 'column' : 'row'};
  justify-content:space-between;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:${c.faint}}
</style></head><body><div class="card"><div class="cols">
<div class="lead"><h1>${esc(data.tagline)}</h1>${data.paragraphs.map((t) => `<p>${esc(t)}</p>`).join('')}
<div class="status"><div class="label">${esc(data.status.label)}</div><p>${esc(data.status.text)}</p></div></div>
<div class="repos"><div class="label">Repositories</div>${repos}</div>
</div><div class="foot">${data.footer.map((t) => `<span>${esc(t)}</span>`).join('')}</div></div></body></html>`;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1000, height: 2000 } });
const tab = await ctx.newPage();
for (const theme of ['light', 'dark']) {
  for (const narrow of [false, true]) {
    await tab.setContent(page(theme, narrow));
    await tab.evaluate(() => document.fonts.ready);
    const file = `profile-${narrow ? 'narrow-' : ''}${theme}.png`;
    await tab.locator('.card').screenshot({ path: path.join(out, file), omitBackground: true });
    console.log(`readme: ${file}`);
  }
}
await browser.close();

// GitHub shows the wide card above 767 px and the narrow one below. The other
// <picture> gets this transparent 1x1 PNG.
const blank = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
await writeFile(path.join(out, 'blank.png'), blank);
await writeFile(stampFile, `${stamp}\n`);
console.log('readme: profile.sha256 updated');
