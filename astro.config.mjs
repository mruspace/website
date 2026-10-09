// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://mru.space',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [mdx()],
  // Copy is final and ported verbatim: no automatic curly quotes or dashes.
  markdown: { smartypants: false },
  devToolbar: { enabled: false },
});
