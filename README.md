# mru.space

![Repobeats analytics](https://repobeats.axiom.co/api/embed/4bb221ccaa0107045df10c7ab08adf12c6e38802.svg "Repobeats analytics image")

The landing page for **Mru** — *A Fault-Tolerant Operating System for
Thousand-Year Autonomous Operation*. A minimal, single-page static site served
via GitHub Pages at [`https://mru.space`](https://mru.space).

> Software that still runs a thousand years after we're gone.

## About this repository

This is the source for [`mru.space`](https://mru.space), shared openly so
you can see exactly how the site is built. Feel free to read it, learn from it,
and borrow ideas — that's why it's here.

Got a question, spotted a typo, or want to help out? Say hi on X at
[@mruspace](https://x.com/mruspace) or email
[contact@mru.space](mailto:contact@mru.space) — we'd love to hear from you.

The code is Apache-2.0 (see [License](#license)); the **Mru** name and logo are
trademarks — see [TRADEMARK.md](./TRADEMARK.md).

## Structure

```
index.html          # the single page (all CSS + the "Mru" font subset inlined)
404.html            # custom not-found page
mru-whitepaper.pdf  # the whitepaper (served at a permanent /mru-whitepaper.pdf URL)
favicon.svg         # the orbit-M mark
apple-touch-icon.png
site.webmanifest    # PWA manifest
robots.txt
sitemap.xml
CNAME               # custom domain (mru.space)
.nojekyll           # serve files as-is, no Jekyll processing
LICENSE             # Apache License 2.0 (the code)
TRADEMARK.md        # trademark notice (the Mru name/logo)
assets/
  og-image.png      # 1200×630 social/link-preview image
  og-source.svg     # editable source for the OG image
  favicon-light.png # light/dark favicon variants
  favicon-dark.png
  icon-192.png      # PWA icons
  icon-512.png
  jost.ttf          # font source for the inlined "Mru" subset
  _gen_icons.sh     # regenerate favicons/icons
  _gen_og.py        # regenerate the OG image
```

Everything is inlined into `index.html` (CSS and a base64 font subset of just
the letters "Mru"), so the page is fully self-contained and renders with no
external requests beyond privacy-first analytics.

## ⚠️ Keep the whitepaper URL stable

The "Paper" button links to `/mru-whitepaper.pdf`. Keep this path **stable
forever** — the PDF itself hard-codes `https://mru.space` as its home. To
update the paper, replace the file in place:

```sh
cp ../mru/mru.pdf ./mru-whitepaper.pdf
git add mru-whitepaper.pdf && git commit -m "Update whitepaper PDF" && git push
```

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deployment

> Maintainers only — the official site auto-deploys.

Merges to `main` publish automatically to `mru.space` via GitHub Pages (the
`CNAME` file pins the custom domain; **Enforce HTTPS** is on). DNS, the
`www` → apex redirect, and `contact@mru.space` email routing are configured
out of band. None of this is needed just to read the code or preview it locally.

## Regenerating assets

```sh
# OG image (from assets/og-source.svg)
magick -background none assets/og-source.svg assets/og-image.png

# favicons / PWA icons
./assets/_gen_icons.sh
```

## License

This repository is **dual-licensed**:

- **Site code** (`index.html`, `404.html`, styles, scripts, build helpers):
  [Apache License 2.0](./LICENSE).
- **Content** (the whitepaper `mru-whitepaper.pdf` and site copy):
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The `mru` reference implementation lives in its own repository and is also
licensed under **Apache License 2.0**.

The **Mru** name, logo, and `mru.space` are trademarks of Binns Pte. Ltd. and
are **not** covered by the code license — see [TRADEMARK.md](./TRADEMARK.md).

© Binns Pte. Ltd.
