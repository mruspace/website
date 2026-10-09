import type { ImageMetadata } from 'astro';
import rows from './images.json';

export interface Photo {
  plate: string;
  id: string;
  file: string;
  caption: string;
  alt: string;
  author: string;
  licence: string;
  licenceUrl: string;
  source: string;
  /** CC BY-SA: adaptations are shared under the same licence. */
  sameLicence: boolean;
  src: ImageMetadata;
}

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.jpg', { eager: true });

export const PHOTOS: Photo[] = rows.map((r) => {
  const mod = files[`../assets/photos/${r.file}`];
  if (!mod) throw new Error(`images.json: missing file src/assets/photos/${r.file}`);
  return { ...r, src: mod.default };
});

export function photo(id: string): Photo {
  const p = PHOTOS.find((x) => x.id === id || x.plate === id);
  if (!p) throw new Error(`images.json: no photo "${id}"`);
  return p;
}

/** The credit line under a plate, as on the canvas: "Author · Licence · Wikimedia Commons". */
export function creditLine(p: Photo): string {
  return `${p.author} · ${p.licence} · Wikimedia Commons`;
}
