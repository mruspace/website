// Draws public/charts/flight-orbit-{light,dark}.svg from the event logs and
// summaries the satellite sent down for experiment exp4051 (OPS-SAT PRETTY,
// 18 October 2026): opssat/results/2026-10-18-ops-sat-pretty-on-board in
// mruspace/flight. The theme and series colors are the ones scripts/chart.py
// in that repo uses. The x axis has a break: the faults all land in the first
// 300 ticks, the runs go on to 5,250.
//
// Run: node scripts/charts/flight-orbit.mjs [path to the flight repo, default ../flight]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FLIGHT = process.argv[2] ?? '../flight';
const DIR = join(FLIGHT, 'opssat/results/2026-10-18-ops-sat-pretty-on-board');

function events(file) {
  const rows = readFileSync(join(DIR, file), 'utf8').trim().split('\n').slice(1);
  return rows.map((r) => {
    const [tick, event, ...detail] = r.split(',');
    return { tick: Number(tick), event, detail: detail.join(',') };
  });
}
function summary(file) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const fields = {};
  for (const m of text.matchAll(/(\w+)=(\S+)/g)) fields[m[1]] = m[2];
  return fields;
}

const shrink = { ev: events('quorum-shrink.csv'), s: summary('summary-shrink.txt') };
const tmr = { ev: events('quorum-tmr.csv'), s: summary('summary-tmr.txt') };
const find = (run, event) => run.ev.find((e) => e.event === event);
const n = (x) => Number(x);

// The numbers the chart shows, each from the files.
const D = {
  injected: find(shrink, 'sensor_injected').tick, // 20
  stuck: find(shrink, 'stuck').tick, // 120
  retired: find(shrink, 'retired').tick, // 122
  killed: find(shrink, 'killed').tick, // 240
  scan: find(shrink, 'sensor_upset').tick, // 250
  shrinkEnd: n(shrink.s.last_useful), // 5250
  shrinkUseful: n(shrink.s.useful), // 2745
  shrinkWrong: n(shrink.s.wrong), // 0
  kats: n(shrink.s.kat_tests), // 80
  tmrUseful: n(tmr.s.useful), // 239
  tmrLastUseful: n(tmr.s.last_useful), // 239
  tmrDetected: n(tmr.s.detected), // 4261
  tmrWrong: n(tmr.s.wrong), // 0
  tmrEnd: find(tmr, 'stopped').tick - 1, // 4500
};
if (
  find(tmr, 'sensor_injected').tick !== D.injected ||
  find(tmr, 'stuck').tick !== D.stuck ||
  find(tmr, 'killed').tick !== D.killed
) {
  throw new Error('the two runs do not share the fault ticks');
}
if (find(shrink, 'stopped').tick - 1 !== D.shrinkEnd) throw new Error('shrink end does not match last_useful');

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
const H = 560;
const M = 56;
const fmt = (x) => x.toLocaleString('en-US');

// Plot box. Left panel: ticks 0 to 300. Right panel: 300 to the end.
const PX0 = M + 24;
const BREAK0 = 540;
const BREAK1 = 568;
const PX1 = W - M - 150;
const LEFT_MAX = 300;
const END = D.shrinkEnd;
const sx = (tick) =>
  tick <= LEFT_MAX
    ? PX0 + ((BREAK0 - PX0) * tick) / LEFT_MAX
    : BREAK1 + ((PX1 - BREAK1) * (tick - LEFT_MAX)) / (END - LEFT_MAX);
const LANE_Y = { shrink: 318, tmr: 428 };
const BAR = 30;
const PY0 = 232;
const PY1 = LANE_Y.tmr + BAR / 2 + 18;

function svg(theme) {
  const t = THEMES[theme];
  const s = [];
  const add = (x) => s.push(x);
  add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  add(
    `<style>text{font-family:${SERIF};fill:${t.ink}} .soft{fill:${t.soft}} .faint{fill:${t.faint}} .display{font-family:${DISPLAY};font-weight:500}</style>`,
  );
  add(
    `<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${t.tmr}" stroke-width="2.5" opacity="0.55"/></pattern></defs>`,
  );
  add(`<rect width="${W}" height="${H}" fill="${t.bg}"/>`);

  // Header
  add(
    `<text class="display" x="${M}" y="${M + 20}" font-size="34">Two policies, the same faults, 110 seconds in orbit.</text>`,
  );
  add(
    `<text x="${M}" y="${M + 58}" font-size="20" class="soft">Events logged by the quorum program on OPS-SAT PRETTY, 18 October 2026. Seed 1, faults from a schedule.</text>`,
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
  for (const tick of [0, 100, 200, 300]) {
    add(
      `<text x="${sx(tick).toFixed(1)}" y="${PY1 + 28}" font-size="17" text-anchor="middle" class="faint">${tick}</text>`,
    );
  }
  for (const tick of [1000, 2000, 3000, 4000, 5000]) {
    add(
      `<text x="${sx(tick).toFixed(1)}" y="${PY1 + 28}" font-size="17" text-anchor="middle" class="faint">${tick / 1000}k</text>`,
    );
  }
  add(
    `<text x="${PX1}" y="${PY1 + 52}" font-size="15" text-anchor="end" class="faint">tick (axis break at 300)</text>`,
  );

  // Fault events: dashed verticals through both lanes, labels above in two rows.
  const marks = [
    [D.injected, 'sensor self-test injected', 0],
    [D.stuck, 'replica 1 stuck', 1],
    [D.killed, 'replica 0 killed', 2],
    [D.scan, 'scan finds and repairs the flip', 0],
  ];
  for (const [tick, label, row] of marks) {
    const x = sx(tick);
    const yLabel = PY0 - 20 + row * 24;
    add(
      `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yLabel + 6}" y2="${PY1}" stroke="${t.faint}" stroke-width="1.5" stroke-dasharray="2 5"/>`,
    );
    const anchor = tick === D.scan ? 'start' : tick === D.killed ? 'end' : 'start';
    const dx = anchor === 'end' ? -6 : 6;
    add(
      `<text x="${(x + dx).toFixed(1)}" y="${yLabel}" font-size="16" text-anchor="${anchor}" class="soft">tick ${tick}: ${label}</text>`,
    );
  }

  // Lanes
  const lane = (y, label) =>
    add(`<text x="${PX0 - 12}" y="${y + 6}" font-size="17" text-anchor="end" class="faint">${label}</text>`);
  // Shrinking quorum: delivering checked results the whole way.
  const yS = LANE_Y.shrink;
  add(
    `<rect x="${sx(0)}" y="${yS - BAR / 2}" width="${(BREAK0 - sx(0)).toFixed(1)}" height="${BAR}" fill="${t.mru}"/>`,
  );
  add(
    `<rect x="${BREAK1}" y="${yS - BAR / 2}" width="${(sx(D.shrinkEnd) - BREAK1).toFixed(1)}" height="${BAR}" fill="${t.mru}"/>`,
  );
  add(
    `<circle cx="${sx(D.retired).toFixed(1)}" cy="${yS}" r="6" fill="${t.bg}" stroke="${t.mru}" stroke-width="2.5"/>`,
  );
  add(
    `<text x="${sx(D.retired).toFixed(1)}" y="${yS + BAR / 2 + 20}" font-size="15" text-anchor="start" class="soft" paint-order="stroke" stroke="${t.bg}" stroke-width="6" stroke-linejoin="round">tick ${D.retired}: stuck replica retired</text>`,
  );
  add(
    `<text x="${sx(D.shrinkEnd) + 12}" y="${yS + 1}" font-size="17" font-weight="700" fill="${t.ink}">${fmt(D.shrinkUseful)} correct</text>`,
  );
  add(
    `<text x="${sx(D.shrinkEnd) + 12}" y="${yS + 21}" font-size="15" class="soft">${D.shrinkWrong} wrong, to tick ${fmt(D.shrinkEnd)}</text>`,
  );
  add(
    `<text x="${(BREAK1 + 12).toFixed(1)}" y="${yS + BAR / 2 + 20}" font-size="15" class="soft">alone on the last replica from tick ${D.killed}, checked by ${D.kats} known-answer tests</text>`,
  );

  // Fixed TMR: results to tick 239, then detected disagreements and no results.
  const yT = LANE_Y.tmr;
  add(
    `<rect x="${sx(0)}" y="${yT - BAR / 2}" width="${(sx(D.tmrLastUseful) - sx(0)).toFixed(1)}" height="${BAR}" fill="${t.tmr}"/>`,
  );
  add(
    `<rect x="${sx(D.killed).toFixed(1)}" y="${yT - BAR / 2}" width="${(BREAK0 - sx(D.killed)).toFixed(1)}" height="${BAR}" fill="url(#hatch)" stroke="${t.tmr}" stroke-width="1.5"/>`,
  );
  add(
    `<rect x="${BREAK1}" y="${yT - BAR / 2}" width="${(sx(D.tmrEnd) - BREAK1).toFixed(1)}" height="${BAR}" fill="url(#hatch)" stroke="${t.tmr}" stroke-width="1.5"/>`,
  );
  add(
    `<text x="${sx(D.tmrEnd) + 12}" y="${yT + 1}" font-size="17" font-weight="700" fill="${t.ink}">${fmt(D.tmrUseful)} correct</text>`,
  );
  add(
    `<text x="${sx(D.tmrEnd) + 12}" y="${yT + 21}" font-size="15" class="soft">${D.tmrWrong} wrong, to tick ${fmt(D.tmrEnd)}</text>`,
  );
  add(
    `<text x="${(BREAK1 + 12).toFixed(1)}" y="${yT + BAR / 2 + 20}" font-size="15" class="soft">one good, one stuck: ${fmt(D.tmrDetected)} disagreements detected, no results</text>`,
  );
  lane(yS, 'Mru');
  lane(yT, 'TMR');

  add('</svg>');
  return s.join('\n') + '\n';
}

for (const theme of ['light', 'dark']) {
  writeFileSync(`public/charts/flight-orbit-${theme}.svg`, svg(theme));
}
console.log('wrote public/charts/flight-orbit-{light,dark}.svg', D);
