// Research log helpers. Entries are ordered by number, newest first.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'research'>;

export async function entries(): Promise<Entry[]> {
  const all = await getCollection('research');
  return all.sort((a, b) => Number(b.data.number) - Number(a.data.number));
}

export function hrefOf(e: Entry): string {
  return e.data.external ?? `/research/${e.id}/`;
}

const KIND_PATH: Record<Entry['data']['kind'], string> = {
  Paper: 'papers',
  Results: 'results',
  Release: 'releases',
  Note: 'notes',
};
export const kindFilter = (kind: Entry['data']['kind']) => `/research/?kind=${KIND_PATH[kind]}`;
export const KIND_SLUGS = KIND_PATH;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
/** "September 29, 2026", US style. */
export const formatDate = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;

export function dateLabel(e: Entry): string {
  return e.data.dateLabel ?? formatDate(e.data.date);
}
