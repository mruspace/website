#!/usr/bin/env node
// Link check on the built site. Internal links must all resolve (fails the
// check). External links are checked and reported, but do not fail it: a
// third-party site being down must not block a deploy.
//   node scripts/check-links.mjs [dist] [--site https://mru.space]
import { LinkChecker } from 'linkinator';
import path from 'node:path';

const dir = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist');
const siteArg = process.argv.indexOf('--site');
const site = siteArg > 0 ? process.argv[siteArg + 1] : 'https://mru.space';
// linkinator serves the folder on a local port: links there are this site's own.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//;

const result = await new LinkChecker().check({
  path: dir,
  recurse: true, // follows local pages only; external links are checked, not crawled
  concurrency: 20,
  timeout: 15000,
  retry: true,
  linksToSkip: async (link) =>
    /^(mailto:|tel:|data:|javascript:)/.test(link) ||
    // The live site is checked after deploy; before it, these point at the old site.
    link.startsWith(site) ||
    // Scripts and endpoints that refuse plain GETs from a checker.
    /fonts\.googleapis|googletagmanager|madruga\.dev\/m\.js|challenges\.cloudflare|api\.mru\.space/.test(link),
});

const local = result.links.filter((l) => LOCAL.test(l.url) || !/^https?:/.test(l.url));
const external = result.links.filter((l) => !local.includes(l) && l.state !== 'SKIPPED');
const broken = local.filter((l) => l.state === 'BROKEN');
for (const l of broken) console.error(`BROKEN ${l.status} ${l.url}  (on ${l.parent})`);
const reported = new Map();
for (const l of external) if (l.state === 'BROKEN' && !reported.has(l.url)) reported.set(l.url, l.status);
for (const [url, status] of reported) console.warn(`external, not fatal: ${status} ${url}`);
const ok = local.filter((l) => l.state === 'OK').length;
const extOk = new Set(external.filter((l) => l.state === 'OK').map((l) => l.url)).size;
console.log(
  `links: ${ok} internal OK, ${broken.length} internal broken; ${extOk} external OK, ${reported.size} external reported`,
);
process.exit(broken.length ? 1 : 0);
