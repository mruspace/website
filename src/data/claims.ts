// Headline numbers, read from claims.json, which scripts/claims/pull.mjs
// writes from the results files in mruspace/flight and mruspace/dusk.
// A page asks for a claim by id; an unknown id fails the build.
import data from './claims.json';

export interface Claim {
  value: unknown;
  format: string;
  text: string;
  ci?: string;
  min_text?: string;
  unit: string;
  scope: string;
  conditions: string;
  source: { repo: string; path?: string; kind?: string; ref?: string; command?: string };
  /** The results-file row a claim came from, when a page shows more than one number from it. */
  detail?: Record<string, unknown>;
}

export const CLAIMS = data.claims as unknown as Record<string, Claim>;
export const CLAIM_SOURCES = data.sources;

export function claim(id: string): Claim {
  const c = CLAIMS[id];
  if (!c) throw new Error(`claims.json: no claim "${id}". Run npm run claims, or fix the id.`);
  return c;
}

/** The claim's text, for templates: {t('dusk.work_vs_tmr')} gives "1.34×". */
export const t = (id: string): string => claim(id).text;

/** "1.33× to 1.35×" for a claim with an interval. */
export function ci(id: string): string {
  const c = claim(id);
  if (!c.ci) throw new Error(`claims.json: claim "${id}" has no interval`);
  return c.ci;
}

// Static copy (metadata descriptions, research frontmatter) cannot call t().
// assertClaims checks it instead: every listed claim's text must appear, and
// every decimal or grouped number in the copy must belong to a listed claim.
// Decimals and grouped integers; version strings such as 0.2.0 are not claims.
const NUM = /(?<![\d.])\d+\.\d+(?![.\d])|\d{1,3}(?:,\d{3})+/g;
const norm = (s: string) => s.replace(/(\d)x\b/g, '$1×');
export function assertClaims(where: string, strings: (string | undefined)[], ids: string[] = []): void {
  if (ids.length === 0) return;
  const copy = norm(strings.filter(Boolean).join('\n'));
  const allowed = new Set<string>();
  for (const id of ids) {
    const c = claim(id);
    if (!copy.includes(c.text) && !copy.includes(c.text.replace('×', '')))
      throw new Error(`claims: ${where} lists ${id} ("${c.text}") but its copy does not contain it`);
    for (const s of [c.text, c.ci, c.min_text]) for (const n of (s ?? '').match(NUM) ?? []) allowed.add(n);
  }
  for (const n of copy.match(NUM) ?? [])
    if (!allowed.has(n)) throw new Error(`claims: ${where} has the number "${n}", which no listed claim gives`);
}
