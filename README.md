<p align="center">
  <a href="https://mru.space">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/assets/readme/mru-github-dark.gif">
      <img src="public/assets/readme/mru-github-light.gif" alt="Mru" width="120" height="120">
    </picture>
  </a>
</p>

# mru.space

The website for **Mru**: fault-tolerant software for systems that cannot be
easily maintained or repaired, on Earth and in space. Static HTML built with
[Astro](https://astro.build), served by GitHub Pages at
[`https://mru.space`](https://mru.space). The documentation is a separate site,
[docs.mru.space](https://docs.mru.space), from
[mruspace/docs](https://github.com/mruspace/docs). The brand files (mark,
lockup, colors, animations) are in [mruspace/brand](https://github.com/mruspace/brand),
shown at `/brand/`.

> Systems that still run a thousand years after we're gone.

Questions, typos, ideas: [contact@mru.space](mailto:contact@mru.space).

## Build and check

Needs Node 22.12 or later.

```sh
npm ci
npm run dev          # http://localhost:4321
npm run build        # dist/: pages, share cards, Markdown twins, llms.txt, sitemap
npm run check        # everything CI runs (below)
```

`npm run check` runs, in order: `astro check`, ESLint and Prettier, the build
(which fails on bad metadata or JSON-LD), html-validate on every page, the link
checker, Playwright (every route at 390, 768, 1440 and 1920 px, light and
dark, plus axe-core, the form and the quorum demo), Lighthouse CI, and the
Worker's tests. Playwright needs `npx playwright install chromium` once.

## Layout

```
src/pages/        routes (one folder per URL)
src/components/   header, footer, form, plates, seams, descent line, quorum demo
src/layouts/      the page shell: head tags, JSON-LD, analytics
src/data/         one source per fact: metadata.json (titles, descriptions,
                  JSON-LD types), use-cases.json, images.json, nav, quorum states
src/content/      research entries (MDX) and the Terms text (kept verbatim)
src/styles/       mru.css (the design system), fonts.css, site.css
public/           files served as-is at stable URLs (see below)
scripts/          share cards, Markdown twins and llms files, checks, fonts
tests/            Playwright and axe-core
worker/           the request-information Worker (api.mru.space/request)
```

Page copy is final and ported verbatim from the approved design. Content that
repeats (use cases, photos, metadata, the quorum demo) lives in `src/data/`, so
the pages, the Markdown twins, `llms.txt`, JSON-LD and the share cards all read
the same source.

## Stable URLs

These must keep working, byte for byte where they are files. They live in
`public/` and are copied unchanged:

- `/mru-whitepaper.pdf`: the PDF hard-codes `https://mru.space`. Replace the
  file in place to update it.
- `/assets/readme/mru-github-dark.gif` and `-light.gif`: used by every mruspace
  README.
- `/favicon.ico`, `/favicon.svg`, `/assets/favicon-light.png`,
  `/assets/favicon-dark.png`, `/apple-touch-icon.png`, `/site.webmanifest`,
  `/assets/og-image.png`
- `/assets/mru.gif`, `/assets/mru-light.gif`, `/assets/mru.mp4`,
  `/assets/mru-light.mp4`
- `/terms/`, `CNAME` (`mru.space`), `.nojekyll`

### The animated mark

GIF has no alpha channel, so each frame ships on a flat backdrop and the page
blends it away: the light art multiplies on paper, the dark art screens on ink.
Anything that gives `.mark-anim`, or an element above it, its own stacking
context (`transform`, `filter`, `opacity`, `z-index`) breaks the blend. The
GIFs start after the page's largest paint; with reduced motion or without
JavaScript, the static SVG mark shows instead.

## Search and AI crawlers

Every page has a title, description, canonical, Open Graph and Twitter tags,
a share card (`/og/<route>.png`) and one JSON-LD graph, all from
`src/data/metadata.json`. Every indexable page has a Markdown twin at
`<route>/index.md`; `/llms.txt` and `/llms-full.txt` list and join them.
`robots.txt` allows search engines and AI crawlers.

## The request form

The form posts to the Worker in `worker/`, which checks the request (origin,
rate limit, honeypot, Cloudflare Turnstile, fields) and emails
contact@mru.space through Resend. Without JavaScript the form still posts and
the Worker redirects to `/contact/sent/`. See `worker/README.md`. No secrets
are in this repository.

## Regenerating assets

```sh
# Fonts (WOFF2 subsets in public/fonts/; needs fonttools and brotli)
python3 scripts/fonts/build_fonts.py

# From public/: favicons and PWA icons, the OG image, the animated mark,
# README copies of the mark (needs ImageMagick, ffmpeg, gifsicle)
cd public
./assets/_gen_icons.sh
magick -background none assets/og-source.svg assets/og-image.png
./assets/_gen_logo_anim.py trace both
(cd assets && ./_gen_readme_gifs.sh)
```

## Visual review

`scripts/compare.mjs` captures each page next to its design artboard at 390,
1440 and 1920 px in both themes, and `scripts/review-page.mjs` builds a
side-by-side review page from the results.

## Deployment

Merges to `main` build and publish to GitHub Pages with
`.github/workflows/deploy.yml`. Pull requests run `npm run check`. The Worker
deploys separately with `npx wrangler deploy` from `worker/`.

## License

- Site code: [Apache License 2.0](./LICENSE).
- Content (the whitepaper and site copy): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Photos: their own free licences, listed on [/credits/](https://mru.space/credits/)
  and in `src/data/images.json`.
- Fonts in `public/fonts/`: SIL Open Font License 1.1 (licence files alongside).
- The **Mru** name, logo and `mru.space` are trademarks of Binns Pte. Ltd. and
  are not covered by these licences. See [TRADEMARK.md](./TRADEMARK.md).

© Binns Pte. Ltd.
