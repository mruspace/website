// robots.txt: everything is open to search engines and AI crawlers, by name
// as well as by the wildcard. noindex pages say so in their own <meta>.
import type { APIRoute } from 'astro';
import { SITE } from '../data/site';

const AGENTS = [
  'Googlebot', 'Bingbot', 'GPTBot', 'ClaudeBot', 'Claude-Web', 'PerplexityBot',
  'Google-Extended', 'Applebot-Extended', 'CCBot',
];

export const GET: APIRoute = () => {
  const body = [
    '# mru.space: open to search engines and AI crawlers.',
    '# Plain-text versions: /llms.txt, /llms-full.txt and index.md beside every page.',
    '',
    ...AGENTS.flatMap((a) => [`User-agent: ${a}`, 'Allow: /', '']),
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE.url}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
