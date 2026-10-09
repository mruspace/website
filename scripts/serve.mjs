#!/usr/bin/env node
// A small static server for tests: serves dist/ like GitHub Pages does
// (directory index.html, 404.html for unknown paths).
//   node scripts/serve.mjs [dist] [port]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4321);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
  '.pf_meta': 'application/octet-stream',
  '.pf_fragment': 'application/octet-stream',
  '.pf_index': 'application/octet-stream',
  '.pagefind': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

async function file(p) {
  try {
    const s = await stat(p);
    if (s.isDirectory()) return file(path.join(p, 'index.html'));
    return p;
  } catch {
    return null;
  }
}

http
  .createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const target = path.join(root, url);
    if (!target.startsWith(root)) return res.writeHead(403).end();
    // GitHub Pages redirects /field to /field/.
    const isDir = await stat(target).then(
      (s) => s.isDirectory(),
      () => false,
    );
    if (!url.endsWith('/') && isDir) {
      return res.writeHead(301, { Location: `${url}/` }).end();
    }
    const found = await file(target);
    if (!found) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(await readFile(path.join(root, '404.html')).catch(() => 'Not found'));
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(found)] ?? 'application/octet-stream' });
    res.end(await readFile(found));
  })
  .listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
