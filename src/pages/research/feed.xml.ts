// RSS for the research log, linked from every page's <head> and from the
// "RSS feed" link on /research/.
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { entries, hrefOf } from '../../data/research';
import { SITE } from '../../data/site';

export async function GET(context: APIContext) {
  const all = await entries();
  return rss({
    title: 'Mru research log',
    description:
      'Everything Mru publishes: the whitepaper, simulation results and software releases, each with its method, its limits and how to cite it.',
    site: context.site ?? SITE.url,
    trailingSlash: true,
    items: all.map((e) => ({
      title: `№ ${e.data.number} · ${e.data.title}`,
      link: new URL(hrefOf(e), SITE.url).href,
      pubDate: e.data.date,
      description: e.data.lede ?? e.data.summary,
      categories: [e.data.kind],
      author: `${SITE.email} (${e.data.author})`,
    })),
    customData: '<language>en</language>',
  });
}
