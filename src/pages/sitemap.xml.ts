// sitemap.xml: every indexable route in metadata.json, with lastmod.
import type { APIRoute } from 'astro';
import { METADATA, isNoindex } from '../data/metadata';
import { entries } from '../data/research';
import { lastmodFor } from '../data/lastmod';

export const GET: APIRoute = async () => {
  const research = await entries();
  const dated = new Map(
    research.filter((e) => !e.data.external).map((e) => [`/research/${e.id}/`, e.data.updated ?? e.data.date]),
  );
  // The log changes when its newest entry does.
  dated.set('/research/', research[0]!.data.updated ?? research[0]!.data.date);
  const urls = METADATA.filter((m) => !isNoindex(m)).map((m) => {
    const path = new URL(m.url).pathname;
    const d = lastmodFor(path, dated.get(path));
    return `  <url><loc>${m.url}</loc><lastmod>${d.toISOString().slice(0, 10)}</lastmod></url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
