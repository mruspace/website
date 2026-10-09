#!/usr/bin/env node
// Build shots/review.html from shots/cmp/summary.json: one row per route,
// canvas and site side by side at each width and theme, with the numbers.
import { readFile, writeFile } from 'node:fs/promises';

const dir = process.argv[2] ?? 'shots/cmp';
const notes = JSON.parse(await readFile(process.argv[3] ?? 'scripts/review-notes.json', 'utf8').catch(() => '{}'));
const prefix = `${dir.split('/').pop()}/`;
const rows = JSON.parse(await readFile(`${dir}/summary.json`, 'utf8'));
const byName = new Map();
for (const r of rows) {
  const name = r.tag.replace(/-(390|1440|1920)-(light|dark)$/, '');
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(r);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let body = '';
for (const [name, list] of byName) {
  body += `<section><h2>${esc(name)}</h2>${notes[name] ? `<p class="note">${esc(notes[name])}</p>` : ''}<div class="grid">`;
  for (const r of list) {
    const first = r.first ? `first difference: ${esc(r.first.ref.tag)} “${esc(r.first.ref.text)}”` : 'layout matches';
    body += `<figure><a href="${prefix}${r.tag}-side.png"><img loading="lazy" src="${prefix}${r.tag}-side.png" alt="${esc(r.tag)}"></a>
      <figcaption><b>${esc(r.tag.replace(name + '-', ''))}</b> · height ${r.dH > 0 ? '+' : ''}${r.dH} px · pixels ${(r.diff * 100).toFixed(1)}% · ${first}</figcaption></figure>`;
  }
  body += '</div></section>';
}
const html = `<!doctype html><meta charset="utf-8"><title>Canvas vs site</title>
<style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;margin:24px;background:#f2f2ee;color:#16161a}
h1{font-weight:500}section{margin:40px 0}h2{font-weight:500;border-bottom:1px solid #cfcfc7}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
figure{margin:0;background:#fff;border:1px solid #e3e3dd;padding:8px}img{width:100%;height:320px;object-fit:cover;object-position:top}
figcaption{font-size:12px;color:#44444c}.note{background:#fff8e6;padding:8px 12px;border-left:3px solid #87650a}</style>
<h1>Canvas (left) vs site (right)</h1><p>Each image: canvas on the left, built site on the right. Click for full size.</p>${body}`;
await writeFile(`${dir}/../review.html`, html);
console.log(`${dir}/../review.html`);
