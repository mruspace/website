// Draws public/charts/flight-orbit-2-{light,dark}.svg from the event logs,
// summaries and checkpoints the satellite sent down for run 2 of experiment
// exp4051 (OPS-SAT PRETTY, 2026-10-22):
// opssat/results/2026-10-22-ops-sat-pretty-on-board-run2 in mruspace/flight.
// Same theme, series colors and axis break as flight-orbit.mjs (№ 006). Three
// lanes: segment 1 (shrinking quorum, lifecycle faults), segment 2 (fixed TMR,
// the same faults) and segment 3 (shrinking quorum, killed and resumed).
//
// Run: node scripts/charts/flight-orbit-2.mjs [path to the flight repo, default ../flight]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FLIGHT = process.argv[2] ?? '../flight';
const DIR = join(FLIGHT, 'opssat/results/2026-10-22-ops-sat-pretty-on-board-run2');
const FLATSAT = join(FLIGHT, 'opssat/results/2026-10-21-tu-graz-flatsat-run2');

function events(file) {
  const rows = readFileSync(join(DIR, file), 'utf8').trim().split('\n').slice(1);
  return rows.map((r) => {
    const [tick, event, ...detail] = r.split(',');
    return { tick: Number(tick), event, detail: detail.join(',') };
  });
}
function fields(file) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const out = {};
  for (const m of text.matchAll(/(\w+)=(\S+)/g)) out[m[1]] = m[2];
  return out;
}

const shrink = { ev: events('quorum-shrink.csv'), s: fields('summary-shrink.txt') };
const tmr = { ev: events('quorum-tmr.csv'), s: fields('summary-tmr.txt') };
const restart = { ev: events('quorum-restart.csv'), s: fields('summary-restart.txt') };
const atKill = fields('checkpoint-restart-at-kill.txt');
const final = fields('checkpoint-restart.txt');
const find = (run, event, detail) =>
  run.ev.find((e) => e.event === event && (detail === undefined || e.detail === detail));
const n = (x) => Number(x);

// The numbers the chart shows, each from the files.
const D = {
  injected: find(shrink, 'sensor_injected').tick, // 20
  outvoted: find(shrink, 'outvoted').tick, // 30
  hang: find(shrink, 'hang').tick, // 60
  stuck: find(shrink, 'stuck').tick, // 120
  retired: find(shrink, 'retired', '1').tick, // 120
  scan: find(shrink, 'sensor_upset').tick, // 250
  stuckbit: find(shrink, 'stuckbit').tick, // 1280
  halted: n(shrink.s.halted_at), // 1281
  shrinkLast: n(shrink.s.last_useful), // 1278
  shrinkUseful: n(shrink.s.useful), // 698
  shrinkWrong: n(shrink.s.wrong), // 0
  kats: n(shrink.s.kat_tests), // 21
  tmrUseful: n(tmr.s.useful), // 119
  tmrLastUseful: n(tmr.s.last_useful), // 119
  tmrDetected: n(tmr.s.detected), // 631
  tmrWrong: n(tmr.s.wrong), // 0
  tmrEnd: find(tmr, 'stopped').tick - 1, // 750
  rStuck: find(restart, 'stuck').tick, // 200
  rRetired: find(restart, 'retired').tick, // 202
  killedAt: n(atKill.tick), // 900
  resumedAt: find(restart, 'resumed').tick, // 900
  rEnd: find(restart, 'stopped').tick - 1, // 1750
  rUseful: n(restart.s.useful), // 1750
  rWrong: n(restart.s.wrong), // 0
};

// What the write-up says, checked against the files.
const fail = (msg) => {
  throw new Error(msg);
};
for (const e of ['outvoted', 'hang', 'stuck', 'sensor_injected', 'sensor_upset']) {
  if (find(tmr, e)?.tick !== find(shrink, e).tick) fail(`segments 1 and 2 do not share the ${e} tick`);
}
if (readFileSync(join(DIR, 'quorum-shrink.csv'), 'utf8') !== readFileSync(join(FLATSAT, 'quorum-shrink.csv'), 'utf8')) {
  fail('the segment 1 event log differs from the FlatSat');
}
if (restart.ev.filter((e) => e.event === 'resumed').length !== 1 || n(restart.s.resumes) !== 1) {
  fail('segment 3 did not resume exactly once');
}
if (n(atKill.resumes) !== 0) fail('segment 3 did not start from tick 0');
if (D.resumedAt !== D.killedAt) fail('the resume tick is not the checkpoint tick');
if (atKill.alive !== '1,0,1' || final.alive !== '1,0,1') fail('replica 1 is not retired across the kill');
if (D.shrinkWrong + D.tmrWrong + D.rWrong !== 0) fail('a segment delivered a wrong result');
if (D.halted !== D.stuckbit + 1) fail('the halt is not on the tick after the stuck bit');

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
const H = 676;
const M = 56;
const fmt = (x) => x.toLocaleString('en-US');

// Plot box. Left panel: ticks 0 to 300. Right panel: 300 to 1,800.
const PX0 = M + 24;
const BREAK0 = 520;
const BREAK1 = 548;
const PX1 = W - M - 170;
const LEFT_MAX = 300;
const END = 1800;
const sx = (tick) =>
  tick <= LEFT_MAX
    ? PX0 + ((BREAK0 - PX0) * tick) / LEFT_MAX
    : BREAK1 + ((PX1 - BREAK1) * (tick - LEFT_MAX)) / (END - LEFT_MAX);
const LANE_Y = { shrink: 338, tmr: 446, restart: 554 };
const BAR = 26;
const PY0 = 214;
const PY1 = LANE_Y.restart + BAR / 2 + 44;

function svg(theme) {
  const t = THEMES[theme];
  const s = [];
  const add = (x) => s.push(x);
  const halo = `paint-order="stroke" stroke="${t.bg}" stroke-width="6" stroke-linejoin="round"`;
  add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  add(
    `<style>text{font-family:${SERIF};fill:${t.ink}} .soft{fill:${t.soft}} .faint{fill:${t.faint}} .display{font-family:${DISPLAY};font-weight:500}</style>`,
  );
  add(
    `<defs><pattern id="hatch2" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${t.tmr}" stroke-width="2.5" opacity="0.55"/></pattern></defs>`,
  );
  add(`<rect width="${W}" height="${H}" fill="${t.bg}"/>`);

  // Header
  add(
    `<text class="display" x="${M}" y="${M + 20}" font-size="34">Down to one replica, a safe halt, and a restart.</text>`,
  );
  add(
    `<text x="${M}" y="${M + 58}" font-size="20" class="soft">Events logged by the quorum program on OPS-SAT PRETTY, October 22, 2026. Seed 1, faults from a schedule.</text>`,
  );
  const key = (x, colour, text, weight) => {
    add(
      `<line x1="${x}" x2="${x + 30}" y1="${M + 99}" y2="${M + 99}" stroke="${colour}" stroke-width="5" stroke-linecap="round"/>`,
    );
    add(`<text x="${x + 42}" y="${M + 106}" font-size="20" font-weight="${weight}">${text}</text>`);
  };
  key(M, t.mru, 'Mru shrinking quorum', 700);
  key(M + 290, t.tmr, 'Fixed triple redundancy (TMR)', 400);

  // Axis: baseline, break glyph, tick labels
  add(`<line x1="${PX0}" x2="${BREAK0}" y1="${PY1}" y2="${PY1}" stroke="${t.rule}" stroke-width="1.5"/>`);
  add(`<line x1="${BREAK1}" x2="${PX1}" y1="${PY1}" y2="${PY1}" stroke="${t.rule}" stroke-width="1.5"/>`);
  add(
    `<path d="M${BREAK0 - 4} ${PY1 + 8} l8 -16 M${BREAK1 - 4} ${PY1 + 8} l8 -16" fill="none" stroke="${t.faint}" stroke-width="1.5"/>`,
  );
  for (const tick of [0, 100, 200, 300, 600, 900, 1200, 1500, 1800]) {
    add(
      `<text x="${sx(tick).toFixed(1)}" y="${PY1 + 28}" font-size="17" text-anchor="middle" class="faint">${fmt(tick)}</text>`,
    );
  }
  add(
    `<text x="${PX1}" y="${PY1 + 52}" font-size="15" text-anchor="end" class="faint">tick (axis break at 300)</text>`,
  );

  // Lifecycle faults (segments 1 and 2): dashed verticals, labels above in rows.
  const marks = [
    [D.injected, 'sensor self-test injected', 0, 'start'],
    [D.outvoted, 'bit flip, replica 2 outvoted', 1, 'start'],
    [D.hang, 'replica 2 hangs', 2, 'start'],
    [D.stuck, 'replica 1 stuck, retired', 3, 'start'],
    [D.scan, 'scan repairs the flip', 0, 'start'],
    [D.stuckbit, 'stuck bit in the last replica', 1, 'end'],
  ];
  const laneBottom = LANE_Y.tmr + BAR / 2 + 8;
  for (const [tick, label, row, anchor] of marks) {
    const x = sx(tick);
    const yLabel = PY0 - 20 + row * 24;
    add(
      `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yLabel + 6}" y2="${laneBottom}" stroke="${t.faint}" stroke-width="1.5" stroke-dasharray="2 5"/>`,
    );
    const dx = anchor === 'end' ? -6 : 6;
    add(
      `<text x="${(x + dx).toFixed(1)}" y="${yLabel}" font-size="16" text-anchor="${anchor}" class="soft" ${halo}>tick ${fmt(tick)}: ${label}</text>`,
    );
  }

  const laneTitle = (y, text) =>
    add(`<text x="${PX0}" y="${y - BAR / 2 - 10}" font-size="16" class="faint" ${halo}>${text}</text>`);
  const bar = (y, a, b, fill, extra = '') => {
    // Splits a bar across the axis break.
    const parts = [];
    if (a < LEFT_MAX) parts.push([sx(a), b <= LEFT_MAX ? sx(b) : BREAK0]);
    if (b > LEFT_MAX) parts.push([a > LEFT_MAX ? sx(a) : BREAK1, sx(b)]);
    for (const [x0, x1] of parts) {
      add(
        `<rect x="${x0.toFixed(1)}" y="${y - BAR / 2}" width="${(x1 - x0).toFixed(1)}" height="${BAR}" fill="${fill}" ${extra}/>`,
      );
    }
  };
  const ring = (tick, y, colour) =>
    add(`<circle cx="${sx(tick).toFixed(1)}" cy="${y}" r="6" fill="${t.bg}" stroke="${colour}" stroke-width="2.5"/>`);
  const endLabel = (tick, y, big, small) => {
    add(
      `<text x="${(sx(tick) + 12).toFixed(1)}" y="${y + 1}" font-size="17" font-weight="700" fill="${t.ink}">${big}</text>`,
    );
    add(`<text x="${(sx(tick) + 12).toFixed(1)}" y="${y + 21}" font-size="15" class="soft">${small}</text>`);
  };
  const note = (x, y, text, anchor = 'start') =>
    add(
      `<text x="${x.toFixed(1)}" y="${y + BAR / 2 + 20}" font-size="15" text-anchor="${anchor}" class="soft" ${halo}>${text}</text>`,
    );

  // Segment 1: checked results to the last good tick, then the safe halt.
  const y1 = LANE_Y.shrink;
  laneTitle(y1, '1 · shrinking quorum');
  bar(y1, 0, D.shrinkLast, t.mru);
  ring(D.retired, y1, t.mru);
  add(
    `<path d="M${(sx(D.halted) - 7).toFixed(1)} ${y1 - 7} l14 14 M${(sx(D.halted) + 7).toFixed(1)} ${y1 - 7} l-14 14" stroke="${t.ink}" stroke-width="2.5" stroke-linecap="round"/>`,
  );
  endLabel(
    D.halted,
    y1,
    `${fmt(D.shrinkUseful)} correct`,
    `${D.shrinkWrong} wrong, safe halt at tick ${fmt(D.halted)}`,
  );
  note(
    sx(D.retired) + 10,
    y1,
    `alone on the last replica from tick ${D.retired}, checked by ${D.kats} known-answer tests`,
  );

  // Segment 2: results to tick 119, then detected disagreements and no results.
  const y2 = LANE_Y.tmr;
  laneTitle(y2, '2 · fixed TMR');
  bar(y2, 0, D.tmrLastUseful, t.tmr);
  bar(y2, D.stuck, D.tmrEnd, 'url(#hatch2)', `stroke="${t.tmr}" stroke-width="1.5"`);
  endLabel(
    D.tmrEnd,
    y2,
    `${fmt(D.tmrUseful)} correct`,
    `${D.tmrWrong} wrong, ${fmt(D.tmrDetected)} detected, no results`,
  );

  // Segment 3: killed at the checkpoint tick and resumed from it.
  const y3 = LANE_Y.restart;
  laneTitle(y3, '3 · shrinking quorum, killed and restarted');
  bar(y3, 0, D.killedAt, t.mru);
  bar(y3, D.resumedAt, D.rEnd, t.mru);
  ring(D.rRetired, y3, t.mru);
  note(sx(D.rRetired) + 10, y3, `tick ${D.rRetired}: stuck replica retired`);
  const xk = sx(D.killedAt);
  add(`<rect x="${(xk - 4).toFixed(1)}" y="${y3 - BAR / 2 - 6}" width="8" height="${BAR + 12}" fill="${t.bg}"/>`);
  add(
    `<line x1="${xk.toFixed(1)}" x2="${xk.toFixed(1)}" y1="${y3 - BAR / 2 - 8}" y2="${y3 + BAR / 2 + 8}" stroke="${t.ink}" stroke-width="2.5" stroke-linecap="round"/>`,
  );
  add(
    `<text x="${(xk + 10).toFixed(1)}" y="${y3 - BAR / 2 - 10}" font-size="15" class="soft" ${halo}>tick ${D.killedAt}: voter killed, resumed from its checkpoint</text>`,
  );
  endLabel(D.rEnd, y3, `${fmt(D.rUseful)} correct`, `${D.rWrong} wrong, one resume`);

  add('</svg>');
  return s.join('\n') + '\n';
}

for (const theme of ['light', 'dark']) {
  writeFileSync(`public/charts/flight-orbit-2-${theme}.svg`, svg(theme));
}
console.log('wrote public/charts/flight-orbit-2-{light,dark}.svg', D);
