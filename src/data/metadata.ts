// Page metadata, one entry per route, ported from the canvas Metadata board.
// Every page looks itself up here; a missing entry fails the build.
import rows from './metadata.json';

export interface PageMeta {
  url: string;
  title: string;
  description: string;
  ogTitle: string;
  /** Open Graph and Twitter description, where it differs from the meta description. */
  ogDescription?: string;
  cardLabel: string;
  schema: string[];
}

export const METADATA: PageMeta[] = rows;

export const LIMITS = { titleMax: 65, descMin: 70, descMax: 160 } as const;

/** noindex pages (404, the sent page) are not held to the description minimum. */
export function isNoindex(m: PageMeta): boolean {
  return m.schema.includes('noindex');
}

export function metaFor(pathname: string): PageMeta {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const m = METADATA.find((x) => new URL(x.url).pathname === path);
  if (!m) throw new Error(`metadata.json: no entry for ${path}`);
  if (m.title.length > LIMITS.titleMax) throw new Error(`metadata.json: title over ${LIMITS.titleMax} for ${path}`);
  const d = m.description.length;
  if (d > LIMITS.descMax || (d < LIMITS.descMin && !isNoindex(m)))
    throw new Error(`metadata.json: description length ${d} out of range for ${path}`);
  return m;
}
