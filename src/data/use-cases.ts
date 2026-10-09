// The fifteen use cases, from the UseCase artboard's data. One source for
// the pages, the index, the Markdown twins, llms.txt and the FAQPage JSON-LD.
import data from './use-cases.json';
import { photo, type Photo } from './images';

export interface Stat {
  v: string;
  u: string;
  l: string;
  src: string;
}
export interface Qa {
  q: string;
  a: string;
}
type RawQa = Qa | { shared: 'HW' | 'START' };

interface RawEntry {
  slug: string;
  key: string;
  name: string;
  kicker: string;
  plate: string;
  cap: string;
  status: string;
  hook: string;
  intro: string;
  stats: Stat[];
  fails: string[];
  last: string;
  fit: { power: string; link: string; visit: string; life: string };
  faq: RawQa[];
  rel: string[];
}

export interface UseCase extends Omit<RawEntry, 'faq'> {
  href: string;
  photo: Photo;
  /** "Is Mru Field a fit for your <lower>?" */
  lower: string;
  faq: Qa[];
  failures: { n: string; t: string; d: string }[];
}

const shared = data.shared as Record<'HW' | 'START', Qa>;
const failures = data.failures as Record<string, { t: string; d: string }>;

export const USE_CASES: UseCase[] = (data.entries as RawEntry[]).map((e) => ({
  ...e,
  href: `/use-cases/${e.slug}/`,
  photo: photo(e.plate),
  lower: e.name.charAt(0).toLowerCase() + e.name.slice(1),
  faq: e.faq.map((q) => ('shared' in q ? shared[q.shared] : q)),
  failures: e.fails.map((k, i) => {
    const f = failures[k];
    if (!f) throw new Error(`use-cases.json: unknown failure mode "${k}"`);
    return { n: `0${i + 1}`, ...f };
  }),
}));

export function useCase(slug: string): UseCase {
  const u = USE_CASES.find((x) => x.slug === slug);
  if (!u) throw new Error(`use-cases.json: no use case "${slug}"`);
  return u;
}

/** The index page groups, with the short kicker and hook used on the index. */
export const INDEX_GROUPS = (
  data.index as { title: string; items: { slug: string; kicker: string; hook: string }[] }[]
).map((g) => ({ title: g.title, items: g.items.map((i) => ({ ...i, uc: useCase(i.slug) })) }));
