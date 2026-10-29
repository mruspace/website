// Draws public/charts/flight-orbit-3-{light,dark}.svg from the event files,
// summaries and state files the satellite sent down for run 3 of experiment
// exp4051 (OPS-SAT PRETTY, 2026-10-28), the F´ deployment:
// opssat/results/2026-10-28-ops-sat-pretty-on-board-run3 in mruspace/flight.
// Same theme and series colors as flight-orbit-2.mjs (№ 007). Three lanes:
// segment 1 (shrinking quorum, the run 1 faults by F´ command sequence and a
// real kill of replica 0's process), segment 2 (fixed TMR, the same faults)
// and segment 3 (shrinking quorum, the manager killed and restored from its
// state file). The axis is in cycles of 100 ms.
//
// Run: node scripts/charts/flight-orbit-3.mjs [path to the flight repo, default ../flight]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FLIGHT = process.argv[2] ?? '../flight';
const DIR = join(FLIGHT, 'opssat/results/2026-10-28-ops-sat-pretty-on-board-run3');

// F´ events as text lines: "EVENT: (id) (time) SEVERITY: (component) Name : text".
function events(file) {
  const out = [];
  for (const line of readFileSync(join(DIR, file), 'utf8').split('\n')) {
    let m = line.match(/^EVENT: \(\d+\) \([\d:,]+\) \w+: \(MruQuorum\.(\w+)\) (\w+) : (.*)$/);
    if (m) {
      const cycle = m[3].match(/(?:at cycle|cycle) (\d+)/);
      out.push({ comp: m[1], event: m[2], text: m[3], cycle: cycle ? Number(cycle[1]) : undefined });
      continue;
    }
    m = line.match(/^FAULT: replica (\d) \(pid \d+\) sent SIGKILL at the start of cycle (\d+): ok$/);
    if (m) out.push({ comp: 'run', event: 'Killed', text: `replica ${m[1]}`, cycle: Number(m[2]) });
  }
  return out;
}
function fields(file) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const out = {};
  for (const m of text.matchAll(/(\w+)=(\S+)/g)) out[m[1]] ??= m[2];
  return out;
}
// The manager's state file: "SURM", version, policy, three slots, the cycle
// (u64, little-endian), CRC-32.
function state(file) {
  const b = readFileSync(join(DIR, file));
  if (b.length !== 21 || b.toString('latin1', 0, 4) !== 'SURM') throw new Error(`${file}: not a state file`);
  return { policy: b[5], slots: [b[6], b[7], b[8]].join(','), cycle: Number(b.readBigUInt64LE(9)) };
}

const shrink = { ev: events('events-shrink.txt'), s: fields('summary-shrink.txt') };
const tmr = { ev: events('events-tmr.txt'), s: fields('summary-tmr.txt') };
const before = { ev: events('events-restart-1.txt') };
const after = { ev: events('events-restart-2.txt'), s: fields('summary-restart.txt') };
const atKill = state('state-restart-at-kill.dat');
const find = (run, event, text) =>
  run.ev.find((e) => e.event === event && (text === undefined || e.text.includes(text)));
const all = (run, event) => run.ev.filter((e) => e.event === event);
const n = (x) => Number(x);

// The numbers the chart shows, each from the files.
const D = {
  flip: find(shrink, 'FaultApplied', 'CORRUPT').cycle, // 60
  stuck: find(shrink, 'FaultApplied', 'STUCK').cycle, // 120
  retired1: find(shrink, 'ReplicaRetired', 'Replica 1').cycle, // 122
  kill: find(shrink, 'Killed').cycle, // 240
  retired0: find(shrink, 'ReplicaRetired', 'Replica 0').cycle, // 242
  selfCheck: find(shrink, 'ModeChanged', 'SELF_CHECK').cycle, // 243
  shrinkLast: n(shrink.s.last_useful), // 448
  shrinkUseful: n(shrink.s.useful), // 342
  shrinkCaught: n(shrink.s.detected), // 3
  shrinkWrong: n(shrink.s.wrong), // 0
  tmrUseful: n(tmr.s.useful), // 239
  tmrLastUseful: n(tmr.s.last_useful), // 239
  tmrCaught: n(tmr.s.detected), // 109
  tmrWrong: n(tmr.s.wrong), // 0
  tmrEnd: n(tmr.s.cycles) - 1, // 348
  rStuck: find(before, 'FaultApplied', 'STUCK').cycle, // 200
  rRetired: find(before, 'ReplicaRetired', 'Replica 1').cycle, // 202
  restored: find(after, 'StateRestored').cycle, // 303
  rLast: n(after.s.last_useful), // 601
  rUseful: n(after.s.useful), // 299
  rWrong: n(after.s.wrong), // 0
};

// What the write-up says, checked against the files.
const fail = (msg) => {
  throw new Error(msg);
};
for (const [e, t] of [
  ['FaultApplied', 'CORRUPT'],
  ['FaultApplied', 'STUCK'],
  ['Killed', undefined],
]) {
  if (find(tmr, e, t)?.cycle !== find(shrink, e, t).cycle)
    fail(`segments 1 and 2 do not share the ${e} ${t ?? ''} cycle`);
}
if (D.shrinkWrong + D.tmrWrong + D.rWrong !== 0) fail('a segment delivered a wrong result');
for (const r of [shrink, tmr, after]) {
  if (n(r.s.late) !== 0) fail('a cycle was withheld in orbit');
  if (r.s.cores !== '0,1,1') fail('a replica ran off its core');
}
if (all(after, 'StateRestored').length !== 1) fail('segment 3 did not restore exactly once');
if (!find(after, 'StateRestored', 'slots [ ACTIVE (0), RETIRED (2), ACTIVE (0) ]'))
  fail('replica 1 not retired after the restore');
if (atKill.slots !== '0,2,0' || atKill.cycle !== D.restored) fail('the restore is not the state file at the kill');
if (all(before, 'StateRestored').length !== 0) fail('segment 3 did not start from an empty folder');
if (shrink.s.slots !== 'retired,retired,active' || tmr.s.slots !== 'retired,active,active')
  fail('slots at the end differ');
if (D.tmrLastUseful !== D.kill - 1) fail('fixed TMR delivered after the kill');

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

// Plot box: cycles 0 to 650, no break.
const PX0 = M + 24;
const PX1 = W - M - 190;
const END = 650;
const sx = (cycle) => PX0 + ((PX1 - PX0) * cycle) / END;
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
    `<defs><pattern id="hatch3" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${t.tmr}" stroke-width="2.5" opacity="0.55"/></pattern></defs>`,
  );
  add(`<rect width="${W}" height="${H}" fill="${t.bg}"/>`);

  // Header
  add(
    `<text class="display" x="${M}" y="${M + 20}" font-size="34">Down to one replica, and a restart of the manager.</text>`,
  );
  add(
    `<text x="${M}" y="${M + 58}" font-size="20" class="soft">Events logged by Mru's flight components on OPS-SAT PRETTY, October 28, 2026. Faults by command sequence, real kills.</text>`,
  );
  const key = (x, colour, text, weight) => {
    add(
      `<line x1="${x}" x2="${x + 30}" y1="${M + 99}" y2="${M + 99}" stroke="${colour}" stroke-width="5" stroke-linecap="round"/>`,
    );
    add(`<text x="${x + 42}" y="${M + 106}" font-size="20" font-weight="${weight}">${text}</text>`);
  };
  key(M, t.mru, 'Mru shrinking quorum', 700);
  key(M + 290, t.tmr, 'Fixed triple redundancy (TMR)', 400);

  // Axis
  add(`<line x1="${PX0}" x2="${PX1}" y1="${PY1}" y2="${PY1}" stroke="${t.rule}" stroke-width="1.5"/>`);
  for (const c of [0, 100, 200, 300, 400, 500, 600]) {
    add(
      `<text x="${sx(c).toFixed(1)}" y="${PY1 + 28}" font-size="17" text-anchor="middle" class="faint">${fmt(c)}</text>`,
    );
  }
  add(`<text x="${PX1}" y="${PY1 + 52}" font-size="15" text-anchor="end" class="faint">cycle (100 ms each)</text>`);

  // Faults of segments 1 and 2: dashed verticals, labels above in rows.
  const marks = [
    [D.flip, 'bit flip in replica 2, outvoted', 0],
    [D.stuck, `replica 1 stuck, retired at ${D.retired1}`, 1],
    [D.kill, `replica 0's process killed, retired at ${D.retired0}`, 2],
  ];
  const laneBottom = LANE_Y.tmr + BAR / 2 + 8;
  for (const [c, label, row] of marks) {
    const x = sx(c);
    const yLabel = PY0 - 20 + row * 24;
    add(
      `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${yLabel + 6}" y2="${laneBottom}" stroke="${t.faint}" stroke-width="1.5" stroke-dasharray="2 5"/>`,
    );
    add(
      `<text x="${(x + 6).toFixed(1)}" y="${yLabel}" font-size="16" class="soft" ${halo}>cycle ${fmt(c)}: ${label}</text>`,
    );
  }

  const laneTitle = (y, text) =>
    add(`<text x="${PX0}" y="${y - BAR / 2 - 10}" font-size="16" class="faint" ${halo}>${text}</text>`);
  const bar = (y, a, b, fill, extra = '') =>
    add(
      `<rect x="${sx(a).toFixed(1)}" y="${y - BAR / 2}" width="${(sx(b) - sx(a)).toFixed(1)}" height="${BAR}" fill="${fill}" ${extra}/>`,
    );
  const ring = (c, y, colour) =>
    add(`<circle cx="${sx(c).toFixed(1)}" cy="${y}" r="6" fill="${t.bg}" stroke="${colour}" stroke-width="2.5"/>`);
  const endLabel = (c, y, big, small) => {
    add(
      `<text x="${(sx(c) + 12).toFixed(1)}" y="${y + 1}" font-size="17" font-weight="700" fill="${t.ink}">${big}</text>`,
    );
    add(`<text x="${(sx(c) + 12).toFixed(1)}" y="${y + 21}" font-size="15" class="soft">${small}</text>`);
  };
  const note = (x, y, text, anchor = 'start') =>
    add(
      `<text x="${x.toFixed(1)}" y="${y + BAR / 2 + 20}" font-size="15" text-anchor="${anchor}" class="soft" ${halo}>${text}</text>`,
    );

  // Segment 1: three, then two replicas to the kill; caught cycles; self-check on the last one.
  const y1 = LANE_Y.shrink;
  laneTitle(y1, '1 · shrinking quorum');
  bar(y1, 0, D.kill, t.mru);
  bar(y1, D.selfCheck, D.shrinkLast, t.mru, 'opacity="0.6"');
  ring(D.retired1, y1, t.mru);
  ring(D.retired0, y1, t.mru);
  endLabel(
    D.shrinkLast,
    y1,
    `${fmt(D.shrinkUseful)} correct`,
    `${D.shrinkWrong} wrong, ${D.shrinkCaught} caught at the kill`,
  );
  add(
    `<text x="${(sx(D.selfCheck) + 10).toFixed(1)}" y="${y1 - BAR / 2 - 10}" font-size="15" class="soft" ${halo}>from cycle ${D.selfCheck}: the last replica alone, in self-check</text>`,
  );

  // Segment 2: results to the cycle before the kill, then caught disagreements and no results.
  const y2 = LANE_Y.tmr;
  laneTitle(y2, '2 · fixed TMR');
  bar(y2, 0, D.tmrLastUseful, t.tmr);
  bar(y2, D.kill, D.tmrEnd, 'url(#hatch3)', `stroke="${t.tmr}" stroke-width="1.5"`);
  endLabel(D.tmrEnd, y2, `${fmt(D.tmrUseful)} correct`, `${D.tmrWrong} wrong, ${fmt(D.tmrCaught)} caught, no results`);

  // Segment 3: run to the kill (no summary: the process was killed), then restored from the state file.
  const y3 = LANE_Y.restart;
  laneTitle(y3, '3 · shrinking quorum, manager killed and restored');
  bar(y3, 0, D.restored, t.mru, 'opacity="0.35"');
  bar(y3, D.restored, D.rLast, t.mru);
  ring(D.rRetired, y3, t.mru);
  note(sx(D.rRetired) - 10, y3, `cycle ${D.rStuck}: replica 1 stuck, retired at ${D.rRetired}`, 'end');
  const xk = sx(D.restored);
  add(`<rect x="${(xk - 4).toFixed(1)}" y="${y3 - BAR / 2 - 6}" width="8" height="${BAR + 12}" fill="${t.bg}"/>`);
  add(
    `<line x1="${xk.toFixed(1)}" x2="${xk.toFixed(1)}" y1="${y3 - BAR / 2 - 8}" y2="${y3 + BAR / 2 + 8}" stroke="${t.ink}" stroke-width="2.5" stroke-linecap="round"/>`,
  );
  add(
    `<text x="${(xk + 10).toFixed(1)}" y="${y3 - BAR / 2 - 10}" font-size="15" class="soft" ${halo}>killed 35 s in; restored at cycle ${D.restored}, replica 1 still retired</text>`,
  );
  endLabel(D.rLast, y3, `${fmt(D.rUseful)} correct`, `${D.rWrong} wrong, after the restore`);

  add('</svg>');
  return s.join('\n') + '\n';
}

for (const theme of ['light', 'dark']) {
  writeFileSync(`public/charts/flight-orbit-3-${theme}.svg`, svg(theme));
}
console.log('wrote public/charts/flight-orbit-3-{light,dark}.svg', D);
