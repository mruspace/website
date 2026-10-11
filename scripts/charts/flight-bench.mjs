// Draws public/charts/flight-bench-{light,dark}.svg from the Mru Flight bench
// results (bench/results/*.json in mruspace/flight, tag v0.2.0). The theme and
// series colors are the ones scripts/chart.py in that repo uses.
//
// Run: node scripts/charts/flight-bench.mjs [path to the flight repo, default ../flight]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FLIGHT = process.argv[2] ?? '../flight';
const RATE = 0.001;
const CASES = [
  ['none', 'Upsets only'],
  ['staggered-kills', 'Two replicas lost, one at a time'],
  ['common-mode', 'Two lost early'],
  ['stuck', 'One stuck, one lost'],
  ['last-stuck', 'Two lost, the last one stuck'],
];

// One row per case. Every host must give the same means, as the post says.
const dir = join(FLIGHT, 'bench/results');
const hosts = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
if (hosts.length !== 3) throw new Error(`expected 3 hosts in ${dir}, found ${hosts.length}`);
const rows = CASES.map(([schedule, label]) => {
  const per = hosts.map((h) => h.summary.find((s) => s.schedule === schedule && s.upset_rate === RATE));
  const key = (s) => JSON.stringify([s.useful_mean, s.useful_ratio_shrink_tmr, s.seeds]);
  if (per.some((s) => !s || key(s) !== key(per[0]))) throw new Error(`hosts differ for ${schedule}`);
  const s = per[0];
  return {
    label,
    tmr: s.useful_mean.tmr,
    shrink: s.useful_mean.shrink,
    ratio: s.useful_ratio_shrink_tmr.mean,
    seeds: s.seeds,
  };
});
const seeds = rows[0].seeds;
const ticks = hosts[0].matrix.ticks;

const THEMES = {
  light: {
    bg: '#fafaf8',
    ink: '#16161a',
    soft: '#44444c',
    faint: '#6f6f78',
    rule: '#e3e3dd',
    mru: '#2a78d6',
    tmr: '#eb6834',
  },
  dark: {
    bg: '#16161a',
    ink: '#ecece8',
    soft: '#c0c0bc',
    faint: '#8f8f8a',
    rule: '#2e2e33',
    mru: '#3987e5',
    tmr: '#d95926',
  },
};
const SERIF = "Charter,'Source Serif 4',Georgia,serif";
const DISPLAY = "Futura,Jost,'Century Gothic',sans-serif";
const W = 1200;
const H = 660;
const M = 56;
const X0 = 400; // bars start
const X1 = 990; // 20,000
const Y0 = 236; // first group
const GROUP = 64;
const BAR = 22;
const n1 = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function svg(t) {
  const sx = (v) => X0 + ((X1 - X0) * v) / ticks;
  const s = [];
  const add = (x) => s.push(x);
  add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  add(
    `<style>text{font-family:${SERIF};fill:${t.ink}} .soft{fill:${t.soft}} .faint{fill:${t.faint}} .display{font-family:${DISPLAY};font-weight:500}</style>`,
  );
  add(`<rect width="${W}" height="${H}" fill="${t.bg}"/>`);

  // header
  const most = Math.max(...rows.map((r) => r.ratio));
  add(
    `<text class="display" x="${M}" y="${M + 20}" font-size="34">Same faults, measured: up to ${most.toFixed(2)}× the correct results</text>`,
  );
  add(
    `<text x="${M}" y="${M + 58}" font-size="20" class="soft">Correct results per run of ${ticks.toLocaleString('en-US')} ticks, on real processors with the same injected faults.</text>`,
  );

  // legend, in the order of the bars
  const key = (x, color, text, weight) => {
    add(
      `<line x1="${x}" x2="${x + 30}" y1="${M + 99}" y2="${M + 99}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`,
    );
    add(`<text x="${x + 42}" y="${M + 106}" font-size="20" font-weight="${weight}">${text}</text>`);
  };
  key(M, t.mru, 'Mru shrinking quorum', 700);
  key(M + 290, t.tmr, 'Fixed triple redundancy (TMR)', 400);

  // grid and axis
  const yEnd = Y0 + GROUP * rows.length - 8;
  for (const v of [0, 5000, 10000, 15000, 20000]) {
    add(`<line x1="${sx(v)}" x2="${sx(v)}" y1="${Y0 - 14}" y2="${yEnd}" stroke="${t.rule}" stroke-width="1.5"/>`);
    add(
      `<text x="${sx(v)}" y="${yEnd + 26}" font-size="17" text-anchor="middle" class="faint">${v ? `${v / 1000}k` : 0}</text>`,
    );
  }
  add(`<text x="${M}" y="${yEnd + 26}" font-size="17" class="faint">correct results</text>`);
  add(`<text x="${W - M}" y="${Y0 - 22}" font-size="17" text-anchor="end" class="faint">Mru ÷ TMR</text>`);

  // bars: 4px round data end, square at the baseline, 2px gap between the pair
  const bar = (y, v, color) => {
    const w = sx(v) - X0;
    const r = 4;
    add(
      `<path d="M${X0},${y} H${(X0 + w - r).toFixed(1)} Q${(X0 + w).toFixed(1)},${y} ${(X0 + w).toFixed(1)},${y + r} V${y + BAR - r} Q${(X0 + w).toFixed(1)},${y + BAR} ${(X0 + w - r).toFixed(1)},${y + BAR} H${X0} Z" fill="${color}"/>`,
    );
    add(`<text x="${(X0 + w + 10).toFixed(1)}" y="${y + 16}" font-size="16" class="soft">${n1(v)}</text>`);
  };
  rows.forEach((r, i) => {
    const y = Y0 + GROUP * i;
    add(`<text x="${M}" y="${y + 29}" font-size="19">${r.label}</text>`);
    bar(y, r.shrink, t.mru);
    bar(y + BAR + 2, r.tmr, t.tmr);
    add(
      `<text x="${W - M}" y="${y + 29}" font-size="19" text-anchor="end" font-weight="700">${r.ratio.toFixed(2)}×</text>`,
    );
  });

  // footer
  add(
    `<text x="${M}" y="${H - 26}" font-size="16" class="faint">Mean of ${seeds} seeds per case, upset rate ${RATE}. The same on all three processors. Data: mruspace/flight v0.2.0, bench/results.</text>`,
  );
  add('</svg>');
  return s.join('\n') + '\n';
}

for (const [name, theme] of Object.entries(THEMES)) {
  const path = `public/charts/flight-bench-${name}.svg`;
  writeFileSync(path, svg(theme));
  console.log(path);
}
console.table(rows);
