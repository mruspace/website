#!/usr/bin/env node
// Checks the built site's search and AI layer. Fails (exit 1) on:
// - a page in metadata.json with no built page, or a built page with no entry
//   (redirects from old URLs excepted)
// - titles over 65 characters, descriptions outside 70 to 160 (noindex pages
//   are exempt from the minimum)
// - missing title, description, canonical, Open Graph or Twitter tags
// - invalid JSON-LD: not exactly one block, bad JSON, wrong context, a node
//   without @type, missing required properties, types that differ from the
//   Metadata board, breadcrumbs or FAQs that differ from what the page shows
// - a missing Markdown twin, llms.txt or llms-full.txt
// Shared with mruspace/docs.
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import config from './config.mjs';

const DIST = path.resolve('dist');
const meta = JSON.parse(await readFile(path.resolve(config.metadata), 'utf8'));
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const exists = (f) =>
  stat(f).then(
    () => true,
    () => false,
  );

const REQUIRED = {
  Organization: ['name', 'url', 'logo'],
  WebSite: ['name', 'url'],
  Person: ['name'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  SoftwareApplication: ['name', 'url', 'applicationCategory', 'operatingSystem'],
  Service: ['name', 'url', 'provider'],
  TechArticle: ['headline', 'url'],
  ScholarlyArticle: ['headline', 'url', 'author', 'datePublished'],
  BlogPosting: ['headline', 'url', 'author', 'datePublished'],
  SoftwareSourceCode: ['codeRepository', 'programmingLanguage', 'license'],
  CollectionPage: ['name', 'url', 'hasPart'],
  Blog: ['name', 'url', 'blogPost'],
  AboutPage: ['name', 'url'],
  ContactPage: ['name', 'url'],
  WebPage: ['name', 'url'],
};

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(f)));
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

const routeOf = (f) => {
  const rel = '/' + path.relative(DIST, f).replace(/\\/g, '/');
  if (rel === '/404.html') return '/404/';
  return rel.replace(/index\.html$/, '');
};
const byRoute = new Map(meta.map((m) => [new URL(m.url).pathname, m]));
const internal = (r) => r.split('/')[1]?.startsWith('_') || r.startsWith('/pagefind');

for (const f of await htmlFiles(DIST)) {
  const route = routeOf(f);
  if (internal(route)) continue;
  const m = byRoute.get(route);
  // A redirect from an old URL (astro.config.mjs) is not a page: no entry needed.
  if (!m && /<meta http-equiv="refresh"/.test(await readFile(f, 'utf8'))) continue;
  if (!m) {
    err(route, 'built page has no entry in metadata.json');
    continue;
  }
  const noindex = m.schema.includes('noindex');
  if (m.title.length > 65) err(route, `title is ${m.title.length} characters (max 65)`);
  const d = m.description.length;
  if (d > 160 || (d < 70 && !noindex)) err(route, `description is ${d} characters (70 to 160)`);

  const { document } = parseHTML(await readFile(f, 'utf8'));
  const q = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr);
  if (document.title !== m.title) err(route, 'title differs from metadata.json');
  if (q('meta[name="description"]') !== m.description) err(route, 'description differs from metadata.json');
  if (document.querySelectorAll('h1').length !== 1)
    err(route, `${document.querySelectorAll('h1').length} h1 elements (want 1)`);
  if (noindex) {
    if (!/noindex/.test(q('meta[name="robots"]') ?? '')) err(route, 'noindex page without robots noindex');
    continue;
  }
  if (q('link[rel="canonical"]', 'href') !== m.url) err(route, 'canonical differs from metadata url');
  for (const p of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:site_name'])
    if (!q(`meta[property="${p}"]`)) err(route, `missing ${p}`);
  for (const n of ['twitter:card', 'twitter:site', 'twitter:creator', 'twitter:title', 'twitter:image'])
    if (!q(`meta[name="${n}"]`)) err(route, `missing ${n}`);
  if (q('meta[property="og:site_name"]') !== config.siteName) err(route, `og:site_name is not "${config.siteName}"`);
  const img = q('meta[property="og:image"]');
  if (img && !(await exists(path.join(DIST, new URL(img).pathname)))) err(route, `share card missing: ${img}`);
  if (!(await exists(path.join(DIST, route, 'index.md')))) err(route, 'Markdown twin missing');

  // JSON-LD
  const blocks = document.querySelectorAll('script[type="application/ld+json"]');
  if (blocks.length !== 1) {
    err(route, `${blocks.length} JSON-LD blocks (want 1)`);
    continue;
  }
  let g;
  try {
    g = JSON.parse(blocks[0].textContent);
  } catch (e) {
    err(route, `JSON-LD does not parse: ${e.message}`);
    continue;
  }
  if (g['@context'] !== 'https://schema.org') err(route, 'JSON-LD @context is not https://schema.org');
  const nodes = g['@graph'] ?? [];
  const types = nodes.map((n) => n['@type']);
  for (const n of nodes) {
    if (!n['@type']) err(route, 'JSON-LD node without @type');
    for (const k of REQUIRED[n['@type']] ?? [])
      if (n[k] === undefined || n[k] === '') err(route, `${n['@type']} lacks ${k}`);
  }
  const visibleCrumbs = [...document.querySelectorAll('nav.crumbs > a, nav.crumbs > span:not([aria-hidden])')].map(
    (e) => e.textContent.trim(),
  );
  for (const t of m.schema.filter((t) => t !== 'noindex')) {
    if (t === 'BreadcrumbList' && !visibleCrumbs.length) continue; // only where the page shows breadcrumbs
    if (!types.includes(t) && !['Organization', 'WebSite'].includes(t))
      err(route, `JSON-LD lacks ${t} (Metadata board)`);
  }
  for (const t of types)
    if (!['Organization', 'WebSite'].includes(t) && !m.schema.includes(t))
      err(route, `JSON-LD has ${t}, not on the Metadata board`);
  const bl = nodes.find((n) => n['@type'] === 'BreadcrumbList');
  if (bl) {
    const names = bl.itemListElement.map((i) => i.name);
    if (JSON.stringify(names) !== JSON.stringify(visibleCrumbs))
      err(route, `BreadcrumbList ${JSON.stringify(names)} differs from the page ${JSON.stringify(visibleCrumbs)}`);
    bl.itemListElement.forEach((i, k) => {
      if (i.position !== k + 1) err(route, 'BreadcrumbList positions are not 1, 2, 3…');
      if (!/^https:\/\//.test(i.item)) err(route, 'BreadcrumbList item is not an absolute URL');
    });
  }
  const faq = nodes.find((n) => n['@type'] === 'FAQPage');
  if (faq) {
    const shown = [...document.querySelectorAll('.faq summary')].map((s) => s.textContent.trim());
    const listed = faq.mainEntity.map((x) => x.name);
    if (JSON.stringify(shown) !== JSON.stringify(listed))
      err(route, 'FAQPage questions differ from the questions on the page');
  }
}
for (const m of meta) {
  const route = new URL(m.url).pathname;
  const f = route === '/404/' ? path.join(DIST, '404.html') : path.join(DIST, route, 'index.html');
  if (!(await exists(f))) err(route, 'in metadata.json but not built');
}
for (const f of ['llms.txt', 'llms-full.txt', 'robots.txt', 'sitemap.xml'])
  if (!(await exists(path.join(DIST, f)))) err(f, 'missing');

if (errors.length) {
  console.error(`SEO check: ${errors.length} problem(s)\n` + errors.map((e) => `  ${e}`).join('\n'));
  process.exit(1);
}
console.log(`SEO check: ${meta.length} routes, titles, descriptions, Open Graph, JSON-LD, twins and llms files OK`);
