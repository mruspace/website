import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // A placeholder for tests only; the real secret is a Wrangler secret.
      miniflare: { bindings: { TURNSTILE_SECRET: 'test-secret' } },
    }),
  ],
});
