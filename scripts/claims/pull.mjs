#!/usr/bin/env node
// Builds src/data/claims.json: every headline number on mru.space and
// docs.mru.space, with its value, unit, scope, conditions and source. Numbers
// come from the results files the code writes, never from a person:
//   - mruspace/flight: bench/results/<date>-<host>.json (the bench, three hosts)
//     and bench/results/<date>-<host>-kat.json (known-answer test coverage),
//     plus the Kani proofs counted in quorum/src/lib.rs and quorum-ffi/src/lib.rs
//   - mruspace/dusk: docs/data.json (written by `cargo run --release --bin charts`)
// Pages read claims.json through src/data/claims.ts. Never edit it by hand.
//
//   node scripts/claims/pull.mjs          read ../flight and ../dusk, else GitHub main
//   node scripts/claims/pull.mjs --check  exit 1 if claims.json is stale
//   CLAIMS_FROM=github ...                always read GitHub main (CI does this)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import prettier from 'prettier';
import { FORMATS } from './format.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, 'src/data/claims.json');
const CHECK = process.argv.includes('--check');
const REMOTE = process.env.CLAIMS_FROM === 'github';
const RAW = (repo, path) => `https://raw.githubusercontent.com/mruspace/${repo}/main/${path}`;
const local = (repo) => resolve(ROOT, '..', repo);
const useLocal = (repo) => !REMOTE && existsSync(join(local(repo), '.git'));

async function text(repo, path) {
  if (useLocal(repo)) return readFileSync(join(local(repo), path), 'utf8');
  const r = await fetch(RAW(repo, path));
  if (!r.ok) throw new Error(`claims: ${RAW(repo, path)}: HTTP ${r.status}`);
  return r.text();
}
async function list(repo, dir) {
  if (useLocal(repo)) return readdirSync(join(local(repo), dir));
  const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const r = await fetch(`https://api.github.com/repos/mruspace/${repo}/contents/${dir}`, { headers });
  if (!r.ok) throw new Error(`claims: listing ${repo}/${dir}: HTTP ${r.status}`);
  return (await r.json()).map((f) => f.name);
}
function headCommit(repo) {
  if (!useLocal(repo)) return 'main';
  return execFileSync('git', ['-C', local(repo), 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
}

// ---------- flight: the bench, three hosts that must agree ----------
const files = await list('flight', 'bench/results');
const dated = (suffix) => {
  const re = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})-(.+?)${suffix}\\.json$`);
  const all = files.map((f) => f.match(re)).filter((m) => m && !m[2].endsWith('-kat') && !m[2].includes('quick'));
  const latest = all
    .map((m) => m[1])
    .sort()
    .at(-1);
  return all.filter((m) => m[1] === latest).map((m) => m[0]);
};
const benchFiles = dated('');
if (benchFiles.length !== 3) throw new Error(`claims: expected 3 bench hosts, found ${benchFiles.join(', ')}`);
const bench = await Promise.all(benchFiles.map(async (f) => JSON.parse(await text('flight', `bench/results/${f}`))));
const pick = (h, schedule, rate) => h.summary.find((s) => s.schedule === schedule && s.upset_rate === rate);
for (const h of bench.slice(1))
  for (const s of h.summary) {
    const a = JSON.stringify(s);
    const b = JSON.stringify(pick(bench[0], s.schedule, s.upset_rate));
    if (a !== b) throw new Error(`claims: bench hosts differ for ${s.schedule} at ${s.upset_rate}`);
  }
const B = bench[0];

const katFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}-.+-kat\.json$/.test(f)).sort();
const kat = katFiles.length ? JSON.parse(await text('flight', `bench/results/${katFiles.at(-1)}`)) : null;

const proofs = async (path) => ((await text('flight', path)).match(/#\[kani::proof\]/g) ?? []).length;
const kaniCore = await proofs('quorum/src/lib.rs');
const kaniFfi = await proofs('quorum-ffi/src/lib.rs');

// ---------- dusk ----------
const D = JSON.parse(await text('dusk', 'docs/data.json'));
for (const [path, ok] of [
  ['headline.work_vs_unchecked', D.headline?.work_vs_unchecked !== undefined],
  ['headline.work_vs_cold', Array.isArray(D.headline?.work_vs_cold)],
  ['policies[].risk', D.policies?.every((p) => p.risk)],
  ['cold.crossing', D.cold?.crossing !== undefined],
])
  if (!ok)
    throw new Error(
      `claims: dusk docs/data.json${REMOTE ? ' on main' : ''} has no ${path}. It comes from dusk's baselines and risk metric; merge that first, or run from a local dusk checkout.`,
    );
const P = (name) => {
  const p = D.policies.find((x) => x.policy === name);
  if (!p) throw new Error(`claims: dusk data.json has no policy "${name}"`);
  return p;
};
const groundAt = (y) => D.ground.points.find((p) => p.years === y);

// ---------- the claims ----------
const DUSK_SCOPE = `Dusk default scenario, ${D.runs.toLocaleString('en-US')} missions, seed ${D.seed}`;
const DUSK_COND =
  'Weibull shape 1.5, scale 125 y, correlated deaths 0.1, upset rate 1e-3, self-check coverage 0.99, self-check throughput 0.5. No ground support after launch. 95% paired bootstrap, 2,000 resamples. Parameters illustrative, not calibrated.';
const DUSK_SRC = (path) => ({
  repo: 'dusk',
  path: `docs/data.json: ${path}`,
  command: 'cargo run --release --bin charts',
});
const BENCH_SCOPE = `Mru Flight bench, mean of ${B.matrix.seeds.length} seeds, ${B.matrix.ticks.toLocaleString('en-US')} ticks per run, three replica processes on one host; the same counts on all three hosts`;
const BENCH_SRC = (path) => ({ repo: 'flight', path: `bench/results/*.json: ${path}`, command: './scripts/bench.sh' });

const C = {};
const add = (id, entry) => {
  const f = FORMATS[entry.format];
  if (!f) throw new Error(`claims: ${id}: unknown format ${entry.format}`);
  C[id] = { ...entry, text: f(entry.value) };
  if (entry.lo !== undefined) C[id].ci = `${f(entry.lo)} to ${f(entry.hi)}`;
  if (entry.min !== undefined) C[id].min_text = f(entry.min);
};

// Dusk headline
add('dusk.runs', {
  value: D.runs,
  format: 'int',
  unit: 'missions',
  scope: DUSK_SCOPE,
  conditions: DUSK_COND,
  source: DUSK_SRC('runs'),
});
{
  const h = D.headline.work_vs_tmr;
  add('dusk.work_vs_tmr', {
    value: h.value,
    lo: h.lo,
    hi: h.hi,
    format: 'ratio2',
    unit: 'the useful work of fixed TMR, total over all missions',
    scope: DUSK_SCOPE,
    conditions: DUSK_COND,
    source: DUSK_SRC('headline.work_vs_tmr'),
  });
}
{
  const h = D.headline.break_even_years;
  add('dusk.break_even_years', {
    value: h.value,
    lo: h.lo,
    hi: h.hi,
    format: 'years0',
    unit: 'years of useful work per wrong result, above which fixed TMR comes out ahead',
    scope: DUSK_SCOPE,
    conditions: DUSK_COND,
    source: DUSK_SRC('headline.break_even_years'),
  });
}
{
  const h = D.headline.wrong_vs_simplex;
  add('dusk.wrong_vs_simplex', {
    value: h.value,
    lo: h.lo,
    hi: h.hi,
    format: 'pct0',
    unit: 'of the wrong results of standby simplex',
    scope: DUSK_SCOPE,
    conditions: DUSK_COND,
    source: DUSK_SRC('headline.wrong_vs_simplex'),
  });
  add('dusk.fewer_wrong_vs_simplex', {
    value: 1 - h.value,
    lo: 1 - h.hi,
    hi: 1 - h.lo,
    format: 'pct0',
    unit: 'fewer wrong results than standby simplex',
    scope: DUSK_SCOPE,
    conditions: DUSK_COND,
    source: DUSK_SRC('1 - headline.wrong_vs_simplex'),
  });
}
for (const [key, name] of [
  ['tmr', 'fixed TMR'],
  ['simplex', 'standby simplex'],
  ['shrink', 'shrinking quorum'],
]) {
  const p = P(name);
  add(`dusk.useful_years.${key}`, {
    value: p.useful_years,
    format: 'years1',
    unit: 'mean useful years per mission',
    scope: `${DUSK_SCOPE}, ${name}`,
    conditions: DUSK_COND,
    source: DUSK_SRC(`policies[${name}].useful_years`),
  });
  add(`dusk.wrong_days.${key}`, {
    value: p.wrong_per_mission,
    format: 'days3',
    unit: 'wrong results per mission (one wrong day is one result)',
    scope: `${DUSK_SCOPE}, ${name}`,
    conditions: DUSK_COND,
    source: DUSK_SRC(`policies[${name}].wrong_per_mission`),
  });
}
{
  const works = D.sweep.rows.flatMap((r) => r.points.map((p) => p.work));
  const lo = Math.min(...works);
  const hi = Math.max(...works);
  C['dusk.sweep.range'] = {
    value: [lo, hi],
    format: 'ratio2',
    text: `${FORMATS.ratio2(lo)} to ${FORMATS.ratio2(hi)}`,
    unit: 'the useful work of fixed TMR, lowest and highest row of the sensitivity sweep',
    scope: `Dusk --sweep, ${D.sweep_runs.toLocaleString('en-US')} missions per row, seed ${D.seed}`,
    conditions: 'One parameter varied at a time, the others at their defaults. No ground support after launch.',
    source: DUSK_SRC('sweep.rows[].points[].work'),
  };
}
for (const y of [0, 25, 50, 100]) {
  const g = groundAt(y);
  add(`dusk.ground.${y}`, {
    value: g.ratio,
    lo: g.lo,
    hi: g.hi,
    format: 'ratio2',
    unit: `the useful work of a ground-commanded fallback, when ground support ends after ${y} years`,
    scope: DUSK_SCOPE,
    conditions: `Ground answers in ${D.ground.latency_days} days. ${DUSK_COND}`,
    source: DUSK_SRC(`ground.points[years=${y}]`),
  });
}
{
  const g = D.ground.points.at(-1);
  add('dusk.ground.never', {
    value: g.ratio,
    lo: g.lo,
    hi: g.hi,
    format: 'ratio2',
    unit: `the useful work of a ground-commanded fallback when ground support never ends (last point, ${g.years} years, past every processor's life)`,
    scope: DUSK_SCOPE,
    conditions: `Ground answers in ${D.ground.latency_days} days. ${DUSK_COND}`,
    source: DUSK_SRC('ground.points[-1]'),
  });
}
// The two autonomous baselines and the per-mission risk metric.
const POLICIES = [
  ['tmr', 'fixed TMR'],
  ['simplex', 'standby simplex'],
  ['shrink', 'shrinking quorum'],
  ['unchecked', 'TMR + unchecked simplex'],
  ['cold_01', 'cold standby, aging 0.1'],
  ['cold_10', 'cold standby, aging 1.0'],
];
for (const [key, name] of POLICIES) {
  const p = P(name);
  add(`dusk.risk.${key}`, {
    value: p.risk.value,
    lo: p.risk.lo,
    hi: p.risk.hi,
    format: 'pct1',
    unit: 'of missions deliver at least one wrong result',
    scope: `${DUSK_SCOPE}, ${name}`,
    conditions: DUSK_COND,
    source: DUSK_SRC(`policies[${name}].risk`),
  });
  if (!C[`dusk.useful_years.${key}`])
    add(`dusk.useful_years.${key}`, {
      value: p.useful_years,
      format: 'years1',
      unit: 'mean useful years per mission',
      scope: `${DUSK_SCOPE}, ${name}`,
      conditions: DUSK_COND,
      source: DUSK_SRC(`policies[${name}].useful_years`),
    });
}
add('dusk.work_vs_unchecked', {
  value: D.headline.work_vs_unchecked,
  format: 'pct0',
  unit: 'of the useful work of TMR with an unchecked simplex fallback',
  scope: DUSK_SCOPE,
  conditions: DUSK_COND,
  source: DUSK_SRC('headline.work_vs_unchecked'),
});
{
  const h = D.headline.wrong_vs_unchecked;
  add('dusk.wrong_vs_unchecked', {
    value: h.value,
    lo: h.lo,
    hi: h.hi,
    format: 'pct2',
    unit: 'of the wrong results of TMR with an unchecked simplex fallback',
    scope: DUSK_SCOPE,
    conditions: DUSK_COND,
    source: DUSK_SRC('headline.wrong_vs_unchecked'),
  });
}
for (const w of D.headline.work_vs_cold) {
  const key = w.aging === 1 ? '10' : String(w.aging).replace('0.', '0');
  add(`dusk.work_vs_cold.${key}`, {
    value: w.value,
    lo: w.lo,
    hi: w.hi,
    format: 'ratio2',
    unit: `the useful work of three-string cold standby, spare aging rate ${w.aging}`,
    scope: DUSK_SCOPE,
    conditions: `Spare aging rate ${w.aging} of a powered processor. ${DUSK_COND}`,
    source: DUSK_SRC(`headline.work_vs_cold[aging=${w.aging}]`),
  });
}
add('dusk.cold.crossing', {
  value: D.cold.crossing,
  format: 'dec2',
  unit: 'spare aging rate below which three-string cold standby does more useful work than the shrinking quorum',
  scope: `Dusk --sweep, cold standby by spare aging rate, ${D.sweep_runs.toLocaleString('en-US')} missions per row`,
  conditions: DUSK_COND,
  source: DUSK_SRC('cold.crossing'),
});
// Two strings (--nodes 2): dusk prints these strings; no structured field yet.
for (const [k, aging] of [
  ['01', 0.1],
  ['10', 1.0],
]) {
  const v = D.display?.[`nodes2_work_vs_cold_${k}`];
  const ci = D.display?.[`nodes2_work_vs_cold_${k}_ci`];
  if (!v) continue;
  const x = (s) => s.replace(/(\d)x\b/g, '$1×');
  C[`dusk.nodes2.work_vs_cold.${k}`] = {
    value: parseFloat(v),
    format: 'ratio2',
    text: x(v),
    ci: x(ci),
    unit: `the useful work of two-string cold standby, spare aging rate ${aging}`,
    scope: 'Dusk --nodes 2, 10,000 missions, seed 1',
    conditions: DUSK_COND,
    source: DUSK_SRC(`display.nodes2_work_vs_cold_${k}`),
  };
}

// Flight bench
const RATE = 0.001;
for (const sch of ['none', 'staggered-kills', 'common-mode', 'stuck', 'last-stuck']) {
  const s = pick(B, sch, RATE);
  add(`flight.bench.ratio.${sch}`, {
    value: s.useful_ratio_shrink_tmr.mean,
    min: s.useful_ratio_shrink_tmr.min,
    format: 'ratio2',
    unit: 'correct results of the shrinking quorum over fixed TMR',
    scope: `${BENCH_SCOPE}, schedule ${sch}`,
    conditions: `Upset rate ${RATE}, common-mode share ${B.matrix.common_mode}, known-answer test every ${B.matrix.kat_period} ticks. General-purpose processors, not flight hardware.`,
    source: BENCH_SRC(`summary[schedule=${sch}, upset_rate=${RATE}].useful_ratio_shrink_tmr`),
  });
  for (const pol of ['tmr', 'shrink'])
    add(`flight.bench.useful.${pol}.${sch}`, {
      value: s.useful_mean[pol],
      format: 'mean1',
      unit: 'correct results per run',
      scope: `${BENCH_SCOPE}, schedule ${sch}, ${pol}`,
      conditions: `Upset rate ${RATE}.`,
      source: BENCH_SRC(`summary[schedule=${sch}, upset_rate=${RATE}].useful_mean.${pol}`),
    });
}
{
  const pairs = B.summary.reduce((n, s) => n + s.seeds, 0);
  const below = B.summary.reduce((n, s) => n + s.seeds_shrink_below_tmr, 0);
  add('flight.bench.pairs', {
    value: pairs,
    format: 'int',
    unit: 'run pairs, shrinking quorum against fixed TMR',
    scope: BENCH_SCOPE,
    conditions: 'Every schedule and upset rate.',
    source: BENCH_SRC('sum of summary[].seeds'),
  });
  add('flight.bench.pairs_below', {
    value: below,
    format: 'int',
    unit: 'run pairs where the shrinking quorum delivered fewer correct results',
    scope: BENCH_SCOPE,
    conditions: 'Every schedule and upset rate.',
    source: BENCH_SRC('sum of summary[].seeds_shrink_below_tmr'),
  });
  add('flight.bench.runs_per_host', {
    value: B.runs.length,
    format: 'int',
    unit: 'runs per host',
    scope: BENCH_SCOPE,
    conditions: '',
    source: BENCH_SRC('runs.length'),
  });
  add('flight.bench.ticks', {
    value: B.matrix.ticks,
    format: 'int',
    unit: 'ticks per run',
    scope: BENCH_SCOPE,
    conditions: '',
    source: BENCH_SRC('matrix.ticks'),
  });
}
{
  const s = pick(B, 'last-stuck', 0.0001);
  add('flight.kat.wrong', {
    value: s.wrong_mean.shrink,
    format: 'int',
    unit: 'wrong results per run before the known-answer test caught a stuck last replica',
    scope: `${BENCH_SCOPE}, schedule last-stuck`,
    conditions: `Upset rate 0.0001, known-answer test every ${B.matrix.kat_period} ticks.`,
    source: BENCH_SRC('summary[schedule=last-stuck, upset_rate=0.0001].wrong_mean.shrink'),
  });
  add('flight.kat.latency_ticks', {
    value: s.detection_latency_mean_ticks,
    format: 'int',
    unit: 'ticks from the stuck fault to its detection',
    scope: `${BENCH_SCOPE}, schedule last-stuck`,
    conditions: `Upset rate 0.0001, known-answer test every ${B.matrix.kat_period} ticks.`,
    source: BENCH_SRC('summary[schedule=last-stuck, upset_rate=0.0001].detection_latency_mean_ticks'),
  });
  const cm = pick(B, 'common-mode', 0.01);
  add('flight.wrong.common_mode_max', {
    value: cm.wrong_mean.shrink,
    format: 'mean1',
    unit: 'wrong results per run from upsets that hit both self-check runs alike',
    scope: `${BENCH_SCOPE}, schedule common-mode`,
    conditions: `Upset rate 0.01, common-mode share ${B.matrix.common_mode}.`,
    source: BENCH_SRC('summary[schedule=common-mode, upset_rate=0.01].wrong_mean.shrink'),
  });
}
for (const h of bench) {
  const max = (k) => Math.max(...h.runs.map((r) => r[k]));
  add(`flight.footprint.${h.host}`, {
    value: max('voter_rss_kib'),
    format: 'mb1',
    unit: 'largest resident memory of any process, over every bench run',
    scope: `Mru Flight bench on ${h.cpu} (${h.host}), commit ${h.commit}`,
    conditions: 'Release build, static where the target allows.',
    source: BENCH_SRC(`max of runs[].voter_rss_kib, ${h.host}`),
  });
}
add('flight.kani.core', {
  value: kaniCore,
  format: 'int',
  unit: 'Kani proofs of the decision core',
  scope: 'quorum/src/lib.rs',
  conditions: 'Run in CI on every change: cargo kani -p quorum -p quorum-ffi.',
  source: { repo: 'flight', path: 'count of #[kani::proof] in quorum/src/lib.rs' },
});
add('flight.kani.ffi', {
  value: kaniFfi,
  format: 'int',
  unit: "Kani proofs that the C interface gives the core's answer",
  scope: 'quorum-ffi/src/lib.rs',
  conditions: 'Run in CI on every change.',
  source: { repo: 'flight', path: 'count of #[kani::proof] in quorum-ffi/src/lib.rs' },
});
add('flight.kani.total', {
  value: kaniCore + kaniFfi,
  format: 'int',
  unit: 'Kani proofs in all',
  scope: 'quorum and quorum-ffi',
  conditions: 'Run in CI on every change.',
  source: { repo: 'flight', path: 'sum of the two counts' },
});

// KAT coverage campaign (flight bench/results/*-kat.json)
if (kat) {
  for (const s of kat.summary) {
    const id = [s.fault, s.location, s.kat_period, s.common_mode]
      .filter((x) => x !== null && x !== undefined && x !== '')
      .join('.');
    add(`flight.kat_coverage.${id}`, {
      value: s.fraction_detected,
      format: 'pct0',
      unit: 'of injected faults detected',
      scope: `Known-answer test coverage campaign, ${s.runs} faults on the last replica, demo task on ${kat.cpu} (${kat.host})`,
      conditions: `Known-answer test every ${s.kat_period} ticks${s.common_mode ? `, common-mode share ${s.common_mode}` : ''}. General-purpose processor, not flight hardware.`,
      source: { repo: 'flight', path: `${katFiles.at(-1)}: summary`, command: './scripts/kat-coverage.sh' },
      detail: s,
    });
    const base = {
      scope: C[`flight.kat_coverage.${id}`].scope,
      conditions: C[`flight.kat_coverage.${id}`].conditions,
      source: C[`flight.kat_coverage.${id}`].source,
    };
    if (s.latency_mean !== null)
      add(`flight.kat_coverage.${id}.latency_mean`, {
        ...base,
        value: s.latency_mean,
        format: 'mean1',
        unit: 'ticks from the fault to detection, mean over detected faults',
      });
    if (s.wrong_before_detection_mean !== null)
      add(`flight.kat_coverage.${id}.wrong_mean`, {
        ...base,
        value: s.wrong_before_detection_mean,
        format: 'mean1',
        unit: 'wrong results before detection, mean over detected faults',
      });
  }
}

// Known-answer test cost, per period: exact test counts, and measured CPU time.
if (kat?.throughput?.[0]?.kat_tests_per_delivered_result !== undefined) {
  for (const r of kat.throughput) {
    const base = {
      scope: `Known-answer test cost, ${r.runs} runs of ${kat.matrix.baseline?.ticks?.toLocaleString('en-US') ?? '?'} ticks per period, self-check on the last replica, demo task on ${kat.cpu} (${kat.host})`,
      conditions:
        'No faults after the two kills. CPU time of the voter and replicas. General-purpose processor, not flight hardware.',
      source: {
        repo: 'flight',
        path: `${katFiles.at(-1)}: throughput[kat_period=${r.kat_period}]`,
        command: './scripts/kat-coverage.sh',
      },
    };
    add(`flight.kat_cost.${r.kat_period}.tests_per_result`, {
      ...base,
      value: r.kat_tests_per_delivered_result,
      format: 'dec4',
      unit: 'known-answer tests per delivered result',
    });
    if (r.cpu_cost_vs_no_test !== null && r.cpu_cost_vs_no_test !== undefined)
      add(`flight.kat_cost.${r.kat_period}.cpu`, {
        ...base,
        value: r.cpu_cost_vs_no_test,
        format: 'pct1',
        unit: 'extra CPU time against no test (median)',
        detail: r,
      });
  }
}

// Kept by hand, with the file that states them.
const MANUAL = {
  'flight.fprime.components': {
    value: 5,
    format: 'int',
    unit: 'F´ components: three for flight, two test-only (FaultInjector, RunRecorder)',
    scope: 'fprime/Mru/Components',
    conditions: 'F´ v4.4.1',
    source: { repo: 'flight', kind: 'manual', ref: 'fprime/Mru/Components/' },
  },
  'flight.fprime.unit_tests': {
    value: 40,
    format: 'int',
    unit: 'F´ unit tests',
    scope: 'fprime/Mru components, fprime-util check in CI',
    conditions: 'HealthRegistry 5, ReplicaHost 5, FaultInjector 8, RedundancyManager 19, RunRecorder 3',
    source: { repo: 'flight', kind: 'manual', ref: 'docs/fprime-design-fpp.md' },
  },
};
for (const [id, e] of Object.entries(MANUAL)) add(id, e);

const out = {
  note: 'Generated by scripts/claims/pull.mjs. Do not edit by hand.',
  generated: new Date().toISOString().slice(0, 10),
  sources: {
    flight: {
      repo: 'mruspace/flight',
      commit: headCommit('flight'),
      bench: benchFiles,
      bench_commits: Object.fromEntries(bench.map((h) => [h.host, h.commit])),
      kat: katFiles.at(-1) ?? null,
      kat_commit: kat?.commit ?? null,
    },
    dusk: {
      repo: 'mruspace/dusk',
      commit: D.generated?.commit ?? headCommit('dusk'),
      runs: D.runs,
      seed: D.seed,
      generated: D.generated ?? null,
    },
  },
  claims: Object.fromEntries(Object.entries(C).sort(([a], [b]) => a.localeCompare(b))),
};

const config = (await prettier.resolveConfig(OUT)) ?? {};
const fmt = await prettier.format(JSON.stringify(out), { ...config, parser: 'json' });
const strip = (s) => JSON.stringify({ ...JSON.parse(s), generated: null, sources: null });
if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '{}';
  if (strip(cur) !== strip(fmt)) {
    const a = JSON.parse(cur).claims ?? {};
    for (const [id, e] of Object.entries(out.claims))
      if (JSON.stringify(a[id]) !== JSON.stringify(e))
        console.error(`stale: ${id}: ${a[id]?.text ?? '(missing)'} -> ${e.text}`);
    for (const id of Object.keys(a)) if (!out.claims[id]) console.error(`stale: ${id} no longer produced`);
    console.error('claims.json is stale. Run: npm run claims');
    process.exit(1);
  }
  console.log(`claims.json: ${Object.keys(out.claims).length} claims, current`);
} else {
  writeFileSync(OUT, fmt);
  console.log(`claims.json: ${Object.keys(out.claims).length} claims written`);
}
