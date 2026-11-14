// Draws public/charts/field-staged-{light,dark}.svg and
// public/charts/field-staged-timeline-{light,dark}.svg from the Mru Field
// staged-update bench: docs/results/2026-11-14-darwin-arm64/staged in
// mruspace/field (field 0.2.0, scripts/staged.sh). Same theme as
// flight-bench.mjs: blue is Mru (the staged update), orange the comparison
// (the new build in every slot at once).
//
// Run: node scripts/charts/field-staged.mjs [path to the field repo, default ../field]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FIELD = process.argv[2] ?? '../field';
const DIR = join(FIELD, 'docs/results/2026-11-14-darwin-arm64/staged');
const CYCLES = 5000;

// staged.csv: bug,rollout,delivered,detected,wrong,alive,halted_at,update
const csv = readFileSync(join(DIR, 'staged.csv'), 'utf8').trim().split('\n');
const head = csv[0].split(',');
const runs = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [head[i], v])));
const run = (bug, rollout) => {
  const r = runs.find((x) => x.bug === bug && x.rollout === rollout);
  if (!r) throw new Error(`no run ${bug} ${rollout}`);
  return { ...r, delivered: +r.delivered, wrong: +r.wrong, alive: +r.alive, correct: +r.delivered - +r.wrong };
};
const n0 = (v) => v.toLocaleString('en-US');

const CASES = [
  ['crash@500', 'Crashes on cycle 500'],
  ['hang@500', 'Hangs on cycle 500'],
  ['wrong@500', 'Wrong from cycle 500'],
  ['every@97', 'Wrong on 1 input in 97'],
  ['kat', 'Fails its known-answer test'],
  ['crash@1500', 'Crashes on cycle 1,500'],
  ['hang@1500', 'Hangs on cycle 1,500'],
  ['wrong@1500', 'Wrong from cycle 1,500'],
  ['wrong@2500', 'Wrong from cycle 2,500 *'],
];
const rows = CASES.map(([bug, label]) => ({ bug, label, staged: run(bug, 'staged'), all: run(bug, 'all-at-once') }));
// what happened to the all-at-once run, from its own numbers
const outcome = (r) => {
  if (r.halted_at !== 'never') return r.halted_at === '0' ? 'never started' : `halted at ${n0(+r.halted_at)}`;
  return r.wrong ? `+${n0(r.wrong)} wrong` : '';
};

const THEMES = {
  light: {
    bg: '#fafaf8',
    ink: '#16161a',
    soft: '#44444c',
    faint: '#6f6f78',
    rule: '#e3e3dd',
    old: '#c9c9c2',
    mru: '#2a78d6',
    tmr: '#eb6834',
  },
  dark: {
    bg: '#16161a',
    ink: '#ecece8',
    soft: '#c0c0bc',
    faint: '#8f8f8a',
    rule: '#2e2e33',
    old: '#4a4a52',
    mru: '#3987e5',
    tmr: '#d95926',
  },
};
const SERIF = "Charter,'Source Serif 4',Georgia,serif";
const DISPLAY = "Futura,Jost,'Century Gothic',sans-serif";
const W = 1200;
const M = 56;

function open(s, t, h) {
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">`);
  s.push(
    `<style>text{font-family:${SERIF};fill:${t.ink}} .soft{fill:${t.soft}} .faint{fill:${t.faint}} .display{font-family:${DISPLAY};font-weight:500}</style>`,
  );
  s.push(`<rect width="${W}" height="${h}" fill="${t.bg}"/>`);
}
// a bar with a 4px round data end, square at the baseline
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

// Fig. 2: correct outputs per run, each bad build, both ways.
function bars(t) {
  const X0 = 430;
  const X1 = 960;
  const Y0 = 220;
  const GROUP = 62;
  const BAR = 22;
  const H = Y0 + GROUP * rows.length + 96;
  const sx = (v) => X0 + ((X1 - X0) * v) / CYCLES;
  const s = [];
  open(s, t, H);
  s.push(
    `<text class="display" x="${M}" y="${M + 20}" font-size="34">One bad build, 5,000 cycles: the correct outputs</text>`,
  );
  s.push(
    `<text x="${M}" y="${M + 58}" font-size="20" class="soft">The same bad build of the demo task, brought into all three slots at once, or by staged update.</text>`,
  );
  key(s, M, M + 99, t.mru, 'Staged update');
  key(s, M + 230, M + 99, t.tmr, 'All at once');

  const yEnd = Y0 + GROUP * rows.length - 8;
  for (const v of [0, 1000, 2000, 3000, 4000, 5000]) {
    s.push(`<line x1="${sx(v)}" x2="${sx(v)}" y1="${Y0 - 14}" y2="${yEnd}" stroke="${t.rule}" stroke-width="1.5"/>`);
    s.push(
      `<text x="${sx(v)}" y="${yEnd + 26}" font-size="17" text-anchor="middle" class="faint">${v ? `${v / 1000}k` : 0}</text>`,
    );
  }
  s.push(`<text x="${M}" y="${yEnd + 26}" font-size="17" class="faint">correct outputs</text>`);
  rows.forEach((r, i) => {
    const y = Y0 + GROUP * i;
    s.push(`<text x="${M}" y="${y + 29}" font-size="19">${r.label}</text>`);
    bar(s, X0, y, sx(r.staged.correct) - X0, BAR, t.mru);
    s.push(
      `<text x="${(sx(r.staged.correct) + 10).toFixed(1)}" y="${y + 16}" font-size="16" class="soft">${n0(r.staged.correct)}${r.staged.wrong ? ` · +${n0(r.staged.wrong)} wrong` : ''}</text>`,
    );
    const ya = y + BAR + 2;
    bar(s, X0, ya, sx(r.all.correct) - X0, BAR, t.tmr);
    const note = outcome(r.all);
    s.push(
      `<text x="${(sx(r.all.correct) + 10).toFixed(1)}" y="${ya + 16}" font-size="16" class="soft">${n0(r.all.correct)}${note ? ` · ${note}` : ''}</text>`,
    );
  });
  s.push(
    `<text x="${M}" y="${H - 46}" font-size="16" class="faint">* After the last switch (cycle 2,000), no slot runs the old build, so nothing can disagree: the stated limit. Trials of 1,000 cycles.</text>`,
  );
  s.push(
    `<text x="${M}" y="${H - 22}" font-size="16" class="faint">Apple M4, reply timeout 200 ms. Wrong = differs from the old build. Data: mruspace/field v0.2.0, docs/results/2026-11-14-darwin-arm64/staged.</text>`,
  );
  s.push('</svg>');
  return s.join('\n') + '\n';
}

// Fig. 1: the build that crashes on cycle 1,500, both ways, slot by slot,
// from the two runs' event logs.
function events(name) {
  return readFileSync(join(DIR, name, 'events.csv'), 'utf8')
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => {
      const [cycle, event, ...rest] = l.split(',');
      return { cycle: +cycle, event, detail: rest.join(',') };
    });
}
const evAll = events('crash-1500-all-at-once');
const evStaged = events('crash-1500-staged');
const allRun = run('crash@1500', 'all-at-once');
const stagedRun = run('crash@1500', 'staged');
// per slot: spans of [from, to, build], and the cycles a replica was lost
function lanesStaged() {
  const lanes = [0, 1, 2].map(() => ({ spans: [], lost: [], build: 'old', from: 0 }));
  const sw = (slot, cycle, build) => {
    const l = lanes[slot];
    if (l.build === build) return;
    l.spans.push([l.from, cycle, l.build]);
    l.build = build;
    l.from = cycle;
  };
  for (const e of evStaged) {
    if (e.event === 'lost') lanes[+e.detail].lost.push(e.cycle);
    if (e.event !== 'candidate') continue;
    const [what, slot] = e.detail.split(' ');
    if (what === 'started') sw(+slot, e.cycle, 'new');
    if (what === 'rolled-back') sw(+slot, e.cycle, 'old');
  }
  for (const l of lanes) l.spans.push([l.from, CYCLES, l.build]);
  return lanes;
}
function lanesAll() {
  const halted = +allRun.halted_at;
  return [0, 1, 2].map((slot) => ({
    spans: [[0, halted, 'new']],
    lost: evAll.filter((e) => e.event === 'lost' && +e.detail === slot).map((e) => e.cycle),
  }));
}
const staged = lanesStaged();
const all = lanesAll();
const rejected = evStaged.find((e) => e.event === 'candidate' && e.detail.startsWith('rejected')).cycle;
const promoted = evStaged.find((e) => e.event === 'candidate' && e.detail.startsWith('promoted')).cycle;

function timeline(t) {
  const H = 680;
  const X0 = 230;
  const X1 = W - M - 20;
  const sx = (v) => X0 + ((X1 - X0) * v) / CYCLES;
  const LANE = 34;
  const BAR = 16;
  const s = [];
  open(s, t, H);
  s.push(
    `<text class="display" x="${M}" y="${M + 20}" font-size="34">A new build that crashes on cycle ${n0(rejected)}</text>`,
  );
  s.push(
    `<text x="${M}" y="${M + 58}" font-size="20" class="soft">Which build each of the three slots ran, cycle by cycle, from the two runs' event logs.</text>`,
  );
  key(s, M, M + 99, t.old, 'Old build');
  key(s, M + 200, M + 99, t.tmr, 'New build');
  s.push(`<text x="${M + 420}" y="${M + 106}" font-size="20">✕ replica lost</text>`);

  const panel = (y0, title, lanes, note) => {
    s.push(`<text class="display" x="${M}" y="${y0}" font-size="22">${title}</text>`);
    lanes.forEach((l, i) => {
      const y = y0 + 22 + LANE * i;
      s.push(`<text x="${M}" y="${y + 13}" font-size="17" class="soft">slot ${i}</text>`);
      for (const [a, b, build] of l.spans) {
        if (b > a)
          s.push(
            `<rect x="${sx(a).toFixed(1)}" y="${y}" width="${(sx(b) - sx(a) - 2).toFixed(1)}" height="${BAR}" rx="3" fill="${build === 'new' ? t.tmr : t.old}"/>`,
          );
      }
      for (const c of l.lost)
        s.push(
          `<text x="${sx(c).toFixed(1)}" y="${y + 14}" font-size="20" text-anchor="middle" font-weight="700">✕</text>`,
        );
    });
    s.push(`<text x="${M}" y="${y0 + 22 + LANE * 3 + 22}" font-size="18" class="soft">${note}</text>`);
  };
  const p1 = 220;
  const p2 = 420;
  panel(
    p1,
    'All at once',
    all,
    `All three replicas lost on cycle ${n0(+allRun.halted_at)}; the run halts. ${n0(allRun.delivered)} outputs delivered.`,
  );
  panel(
    p2,
    'Staged update',
    staged,
    `Rejected on cycle ${n0(rejected)}; every slot back on the old build. ${n0(stagedRun.delivered)} delivered, ${stagedRun.wrong} wrong, ${stagedRun.alive} alive.`,
  );
  // marks for the staged run
  const top = p2 + 10;
  const bot = p2 + 22 + LANE * 3 - 10;
  s.push(
    `<line x1="${sx(promoted)}" x2="${sx(promoted)}" y1="${top}" y2="${bot}" stroke="${t.faint}" stroke-width="1.5" stroke-dasharray="4 4"/>`,
  );
  s.push(
    `<text x="${sx(promoted) - 8}" y="${p2 - 4}" font-size="16" text-anchor="end" class="faint">slot 2 passes</text>`,
  );
  s.push(
    `<line x1="${sx(rejected)}" x2="${sx(rejected)}" y1="${top}" y2="${bot}" stroke="${t.faint}" stroke-width="1.5" stroke-dasharray="4 4"/>`,
  );
  s.push(`<text x="${sx(rejected) + 8}" y="${p2 - 4}" font-size="16" class="faint">rejected, rolled back</text>`);
  // axis
  const ya = H - 80;
  for (const v of [0, 1000, 2000, 3000, 4000, 5000]) {
    s.push(`<line x1="${sx(v)}" x2="${sx(v)}" y1="${ya - 8}" y2="${ya}" stroke="${t.faint}" stroke-width="1.5"/>`);
    s.push(`<text x="${sx(v)}" y="${ya + 22}" font-size="17" text-anchor="middle" class="faint">${n0(v)}</text>`);
  }
  s.push(`<text x="${M}" y="${ya + 22}" font-size="17" class="faint">cycle</text>`);
  s.push(
    `<text x="${M}" y="${H - 20}" font-size="16" class="faint">Trials of 1,000 cycles. Apple M4. Data: mruspace/field v0.2.0, docs/results/2026-11-14-darwin-arm64/staged/crash-1500-*.</text>`,
  );
  s.push('</svg>');
  return s.join('\n') + '\n';
}

for (const [name, theme] of Object.entries(THEMES)) {
  for (const [chart, fn] of [
    ['field-staged', bars],
    ['field-staged-timeline', timeline],
  ]) {
    const path = `public/charts/${chart}-${name}.svg`;
    writeFileSync(path, fn(theme));
    console.log(path);
  }
}
console.table(
  rows.map((r) => ({
    case: r.label,
    staged: r.staged.correct,
    stagedWrong: r.staged.wrong,
    all: r.all.correct,
    allWrong: r.all.wrong,
    allHalted: r.all.halted_at,
  })),
);
