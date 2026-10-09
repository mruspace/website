// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mru.space',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Pages are static HTML. No client framework.
  devToolbar: { enabled: false },
});
