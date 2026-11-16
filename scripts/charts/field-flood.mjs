// Draws public/charts/field-flood-{light,dark}.svg from the Mru Field flood
// bench: docs/results/2026-11-16-linux-aarch64/flood in mruspace/field
// (field 0.3.0, scripts/flood.py). Same theme as field-staged.mjs: blue is
// Mru 0.3.0 with its flood limits on, orange the comparison (the lock off,
// input_backlog = queue, field 0.2.0).
//
// Run: node scripts/charts/field-flood.mjs [path to the field repo, default ../field]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FIELD = process.argv[2] ?? '../field';
const DIR = join(FIELD, 'docs/results/2026-11-16-linux-aarch64/flood');

function table(name) {
  const csv = readFileSync(join(DIR, `${name}.csv`), 'utf8')
    .trim()
    .split('\n');
  const head = csv[0].split(',');
  return csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [head[i], v])));
}
const find = (rows, want) => {
  const r = rows.find((x) => Object.entries(want).every(([k, v]) => x[k] === v));
  if (!r) throw new Error(`no row ${JSON.stringify(want)}`);
  return r;
};
const n0 = (v) => v.toLocaleString('en-US');

const lock = table('lock');
const backlog = table('backlog');
const stall = table('stall');
const dg = (network, rollout) => +find(lock, { network, rollout }).datagrams_received;
const age = (b) => +find(backlog, { rate_per_s: '10000', backlog: b }).age_last_ms;
const ageLabel = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms.toFixed(1)} ms`);
const oldStall = find(stall, { build: 'old' });
const newStall = find(stall, { build: 'this' });

const PANELS = [
  {
    title: 'A new build that floods a network, with every output right',
    unit: 'datagrams sent',
    max: dg('allow', 'all-at-once'),
    rows: [
      ['Lock off, all at once', dg('allow', 'all-at-once'), 'cmp', n0(dg('allow', 'all-at-once'))],
      ['Lock off, staged update', dg('allow', 'staged'), 'cmp', `${n0(dg('allow', 'staged'))} · the update took it in`],
      ['Lock on, all at once', dg('deny', 'all-at-once'), 'mru', n0(dg('deny', 'all-at-once'))],
      ['Lock on, staged update', dg('deny', 'staged'), 'mru', n0(dg('deny', 'staged'))],
    ],
  },
  {
    title: 'Input 100 times faster than the cycle: its age at the last cycle',
    unit: 'age of the input',
    max: age('queue'),
    rows: [
      ['Every record in turn (queue)', age('queue'), 'cmp', ageLabel(age('queue'))],
      ['Newest record (newest)', age('newest'), 'mru', ageLabel(age('newest'))],
    ],
  },
  {
    title: 'An output peer that stops reading: time until the run ends',
    unit: 'seconds',
    max: +oldStall.seconds,
    rows: [
      ['Version 0.2.0', +oldStall.seconds, 'cmp', 'hung · killed at 60 s'],
      ['Version 0.3.0', +newStall.seconds, 'mru', `${newStall.seconds} s · sink-error, checkpoint kept`],
    ],
  },
];

const THEMES = {
  light: {
    bg: '#fafaf8',
    ink: '#16161a',
    soft: '#44444c',
    faint: '#6f6f78',
    rule: '#e3e3dd',
    mru: '#2a78d6',
    cmp: '#eb6834',
  },
  dark: {
    bg: '#16161a',
    ink: '#ecece8',
    soft: '#c0c0bc',
    faint: '#8f8f8a',
    rule: '#2e2e33',
    mru: '#3987e5',
    cmp: '#d95926',
  },
};
const SERIF = "Charter,'Source Serif 4',Georgia,serif";
const DISPLAY = "Futura,Jost,'Century Gothic',sans-serif";
const W = 1200;
const M = 56;
const X0 = 400;
const X1 = 900;
const ROW = 42;
const BAR = 24;
const TOP = 200;
const GAP = 64;
const H = TOP + PANELS.reduce((h, p) => h + GAP + ROW * p.rows.length, 0) + 84;

function bar(s, x0, y, w, hgt, color) {
  if (w <= 0) return;
  const r = Math.min(4, w / 2);
  const x1 = x0 + w;
  s.push(
    `<path d="M${x0},${y} H${(x1 - r).toFixed(1)} Q${x1.toFixed(1)},${y} ${x1.toFixed(1)},${y + r} V${y + hgt - r} Q${x1.toFixed(1)},${y + hgt} ${(x1 - r).toFixed(1)},${y + hgt} H${x0} Z" fill="${color}"/>`,
  );
}
function key(s, x, y, color, text) {
  s.push(
    `<line x1="${x}" x2="${x + 30}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`,
  );
  s.push(`<text x="${x + 42}" y="${y + 7}" font-size="20">${text}</text>`);
}

function draw(t) {
  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  s.push(
    `<style>text{font-family:${SERIF};fill:${t.ink}} .soft{fill:${t.soft}} .faint{fill:${t.faint}} .display{font-family:${DISPLAY};font-weight:500}</style>`,
  );
  s.push(`<rect width="${W}" height="${H}" fill="${t.bg}"/>`);
  s.push(`<text class="display" x="${M}" y="${M + 20}" font-size="34">Flood limits in Mru Field 0.3.0</text>`);
  s.push(
    `<text x="${M}" y="${M + 58}" font-size="20" class="soft">Three bench runs on Linux: what a node sends, how old its input gets, and whether it keeps control.</text>`,
  );
  key(s, M, M + 99, t.mru, 'Flood limits on');
  key(s, M + 250, M + 99, t.cmp, 'Lock off, queue, or version 0.2.0');
  let y = TOP;
  for (const p of PANELS) {
    s.push(`<text x="${M}" y="${y + 20}" font-size="21" class="display">${p.title}</text>`);
    y += GAP - 14;
    const top = y - 6;
    const bottom = y + ROW * p.rows.length - 12;
    s.push(`<line x1="${X0}" x2="${X0}" y1="${top}" y2="${bottom}" stroke="${t.rule}" stroke-width="1.5"/>`);
    for (const [label, v, c, note] of p.rows) {
      s.push(`<text x="${M}" y="${y + 18}" font-size="19">${label}</text>`);
      const w = ((X1 - X0) * v) / p.max;
      bar(s, X0, y, w, BAR, t[c]);
      // a value too small to draw as a bar still shows its color at zero
      if (w < 3) s.push(`<circle cx="${X0 + 3}" cy="${y + BAR / 2}" r="5" fill="${t[c]}"/>`);
      s.push(
        `<text x="${(X0 + Math.max(w, 8) + 10).toFixed(1)}" y="${y + 18}" font-size="17" class="soft">${note}</text>`,
      );
      y += ROW;
    }
    y += 14;
  }
  s.push(
    `<text x="${M}" y="${H - 50}" font-size="16" class="faint">Lock: 2,000 cycles, 100 datagrams per request from cycle 500. Backlog: 10,000 records a second into 100 cycles a second.</text>`,
  );
  s.push(
    `<text x="${M}" y="${H - 26}" font-size="16" class="faint">Linux in Docker on one Apple M4. Data: mruspace/field v0.3.0, docs/results/2026-11-16-linux-aarch64/flood.</text>`,
  );
  s.push('</svg>');
  return s.join('\n') + '\n';
}

for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(`public/charts/field-flood-${name}.svg`, draw(t));
}
console.log(`field-flood: ${H}px, from ${DIR}`);
