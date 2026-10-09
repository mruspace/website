#!/usr/bin/env node
// After `astro build`: write a Markdown twin of every indexable page
// (dist/<route>/index.md), then /llms.txt and /llms-full.txt.
// The twin is made from the built page itself, so it always says what the
// page says. Shared with mruspace/docs; each repo has its own
// scripts/seo/config.mjs.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { tables, strikethrough } from 'turndown-plugin-gfm';
import config from './config.mjs';

const DIST = path.resolve('dist');
const meta = JSON.parse(await readFile(path.resolve(config.metadata), 'utf8'));
const pages = meta.filter((m) => !m.schema.includes('noindex'));

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});
td.use([tables, strikethrough]);
// Code blocks keep their text exactly (the highlighting spans are dropped).
td.addRule('pre', {
  filter: (n) => n.nodeName === 'PRE',
  replacement: (_c, n) => `\n\n\`\`\`\n${n.textContent.replace(/\n$/, '')}\n\`\`\`\n\n`,
});
// Figures and charts: their alt text, as the brief asks for twins.
td.addRule('svg', {
  filter: (n) => n.nodeName === 'svg' || n.nodeName === 'SVG',
  replacement: (_c, n) => {
    const label = n.getAttribute('aria-label');
    return label ? `\n\n*Figure: ${label}*\n\n` : '';
  },
});
// Tables without a header row (key and value pairs) become a list:
// "- **Key**: value · value". GFM tables need a header row.
td.addRule('headerlessTable', {
  filter: (n) => n.nodeName === 'TABLE' && n.getElementsByTagName('th').length === 0,
  replacement: (_c, n) => {
    const rows = Array.from(n.getElementsByTagName('tr')).map((tr) => {
      const cells = Array.from(tr.getElementsByTagName('td')).map((td) => td.textContent.replace(/\s+/g, ' ').trim());
      const [k, ...v] = cells;
      return `- **${k}**: ${v.join(' · ')}`;
    });
    return `\n\n${rows.join('\n')}\n\n`;
  },
});
// Breadcrumbs: "Mru / Mru Field".
td.addRule('crumbs', {
  filter: (n) => n.nodeName === 'NAV' && /(^| )crumbs( |$)/.test(n.getAttribute('class') ?? ''),
  replacement: (_c, n) => {
    const parts = Array.from(n.childNodes)
      .filter((c) => c.nodeType === 1)
      .filter((c) => c.getAttribute('aria-hidden') !== 'true')
      .map((c) => (c.nodeName === 'A' ? `[${c.textContent.trim()}](${c.getAttribute('href')})` : c.textContent.trim()));
    return `\n\n${parts.join(' / ')}\n\n`;
  },
});
// Table cells must stay on one line.
td.addRule('cellBreaks', {
  filter: 'br',
  replacement: (_c, n) => {
    for (let p = n.parentNode; p; p = p.parentNode) if (p.nodeName === 'TD' || p.nodeName === 'TH') return ' ';
    return '  \n';
  },
});

function clean(doc, pageUrl) {
  const main = doc.querySelector(config.mainSelector);
  if (!main) throw new Error(`no ${config.mainSelector} in ${pageUrl}`);
  // Interactive or decorative parts that have no meaning as text.
  for (const sel of config.drop) for (const el of main.querySelectorAll(sel)) el.remove();
  for (const el of main.querySelectorAll('[hidden]')) el.remove();
  for (const el of main.querySelectorAll('[aria-hidden="true"]:not(svg)')) {
    if (!el.closest('nav.crumbs')) el.remove();
  }
  for (const el of main.querySelectorAll('[style]')) el.removeAttribute('style');
  // Margin-note and callout labels: "Note 3: …", "Status: …".
  for (const el of main.querySelectorAll('.note > .tiny, .callout > .tiny'))
    el.textContent = `${el.textContent.trim()}:`;
  // Flex rows put elements side by side with no space between them in the
  // source. Keep a space, so "Mru Field · Earth" and "Core TRL 3" stay apart.
  for (const el of [...main.querySelectorAll('*')]) {
    const next = el.nextSibling;
    if (next && next.nodeType === 1 && !/^(TD|TH|TR|LI|DT|DD)$/.test(el.nodeName)) el.after(doc.createTextNode(' '));
  }
  // <picture> → its <img>, with an absolute src.
  for (const pic of main.querySelectorAll('picture')) {
    const img = pic.querySelector('img');
    if (img) pic.replaceWith(img);
    else pic.remove();
  }
  for (const img of main.querySelectorAll('img')) {
    if (!img.getAttribute('alt')) {
      img.remove();
      continue;
    }
    img.setAttribute('src', new URL(img.getAttribute('src'), pageUrl).href);
  }
  for (const a of main.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (!href.startsWith('mailto:')) a.setAttribute('href', new URL(href, pageUrl).href);
  }
  return main;
}

function tidy(md) {
  return md
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

const twins = [];
for (const m of pages) {
  const route = new URL(m.url).pathname;
  const file = path.join(DIST, route, 'index.html');
  const html = await readFile(file, 'utf8');
  const { document } = parseHTML(html);
  const main = clean(document, m.url);
  const body = tidy(td.turndown(main.innerHTML));
  const head = [
    '---',
    `title: ${JSON.stringify(m.ogTitle)}`,
    `url: ${m.url}`,
    `description: ${JSON.stringify(m.description)}`,
    '---',
    '',
  ].join('\n');
  const md = `${head}\n${body}\n`;
  await writeFile(path.join(DIST, route, 'index.md'), md);
  twins.push({ m, route, md });
}

const name = (m) => m.title.replace(/ · Mru (Aerospace|Field|Docs)$/, '');
const twinUrl = (m) => `${m.url.replace(/\/$/, '')}/index.md`.replace(/\/\/index\.md$/, '/index.md');

// llms.txt (llmstxt.org): title, summary, then sections of links.
const lines = [`# ${config.title}`, '', `> ${config.summary}`, ''];
if (config.intro) lines.push(config.intro, '');
for (const section of config.sections) {
  const items = section.match ? pages.filter((p) => section.match(new URL(p.url).pathname)) : [];
  const extra = section.links ?? [];
  if (!items.length && !extra.length) continue;
  lines.push(`## ${section.title}`, '');
  for (const p of items) lines.push(`- [${name(p)}](${twinUrl(p)}): ${p.description}`);
  for (const l of extra) lines.push(`- [${l.title}](${l.url}): ${l.description}`);
  lines.push('');
}
await writeFile(path.join(DIST, 'llms.txt'), lines.join('\n'));

// llms-full.txt: every twin, in nav order, each under its title and URL.
const full = [`# ${config.title}`, '', `> ${config.summary}`, ''];
for (const t of twins)
  full.push(
    '---',
    '',
    `# ${name(t.m)}`,
    '',
    `URL: ${t.m.url}`,
    '',
    t.md.replace(/^---\n[\s\S]*?\n---\n/, '').trim(),
    '',
  );
await writeFile(path.join(DIST, 'llms-full.txt'), full.join('\n'));

console.log(`postbuild: ${twins.length} Markdown twins, llms.txt, llms-full.txt`);
