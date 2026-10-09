// lastmod for the sitemap: the research entry's own dates, otherwise the last
// commit that touched the page's source or data. Needs full git history in CI
// (actions/checkout with fetch-depth: 0); falls back to the build date.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const cache = new Map<string, Date | null>();

function gitDate(files: string[]): Date | null {
  const key = files.join('|');
  if (!cache.has(key)) {
    let d: Date | null = null;
    try {
      const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...files.filter(existsSync)], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      d = out ? new Date(out) : null;
    } catch {
      d = null;
    }
    cache.set(key, d);
  }
  return cache.get(key) ?? null;
}

/** Source files whose last change dates a route. */
export function sourcesFor(path: string): string[] {
  const p = path.replace(/^\/|\/$/g, '');
  if (!p) return ['src/pages/index.astro'];
  if (p.startsWith('use-cases/') && p !== 'use-cases')
    return ['src/data/use-cases.json', 'src/pages/use-cases/[slug].astro', 'src/data/images.json'];
  if (p === 'use-cases') return ['src/pages/use-cases/index.astro', 'src/data/use-cases.json'];
  return [`src/pages/${p}/index.astro`, `src/pages/${p}.astro`];
}

export function lastmodFor(path: string, contentDate?: Date): Date {
  return contentDate ?? gitDate(sourcesFor(path)) ?? new Date();
}
