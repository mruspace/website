# Request Worker (`api.mru.space/request`)

Receives the request-information form from mru.space and sends one plain-text
email to contact@mru.space, with Reply-To set to the requester.

- `POST /request` only. CORS and the `Origin` check allow only `https://mru.space`.
- Checks: per-IP rate limit (5 a minute), honeypot field `website`, Cloudflare
  Turnstile, email format, field lengths (name 200, organisation 200,
  message 5,000), known role and interest.
- Replies: JSON for `fetch()` (`Accept: application/json`); a 303 redirect to
  `https://mru.space/contact/sent/` for a plain form post (no JavaScript); plain
  4xx messages otherwise.

## Develop and test

```sh
npm ci
npm test          # Vitest in the Workers runtime (@cloudflare/vitest-pool-workers)
npm run typecheck
npm run types     # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

## One-time setup (Cloudflare)

Nothing secret is in this folder. Before the first deploy:

1. Email Routing on `mru.space`, with `contact@mru.space` as a verified destination.
2. A Turnstile widget for `mru.space`. Put its public site key in
   `src/config/form.ts` (`turnstileSiteKey`) in the site, and its secret here:
   `npx wrangler secret put TURNSTILE_SECRET`.
3. `npx wrangler deploy`. The `api.mru.space` custom domain is created from
   `wrangler.jsonc`.
