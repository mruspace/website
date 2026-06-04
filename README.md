# mru.systems

The landing page for **Mru** — *A Fault-Tolerant Operating System for
Thousand-Year Autonomous Operation*. A minimal, single-page static site served
via GitHub Pages at [`https://mru.systems`](https://mru.systems).

## Structure

```
index.html          # the single page (all CSS inlined for performance)
404.html            # custom not-found page
mru-whitepaper.pdf  # the whitepaper — MUST BE ADDED (see below)
favicon.svg/.ico    # the "maru" circle mark
apple-touch-icon.png
site.webmanifest
robots.txt
sitemap.xml
CNAME               # custom domain (mru.systems)
.nojekyll           # serve files as-is, no Jekyll processing
assets/
  og-image.png      # 1200×630 social/link-preview image
  og-source.svg     # editable source for the OG image
  icon-192/512.png  # PWA icons
```

## ⚠️ One required manual step: add the whitepaper PDF

The download buttons link to `/mru-whitepaper.pdf`, but the PDF is **not yet in
this repo** (the sibling `mru/mru.pdf` source was not present at build time).
Before launch:

```sh
cp ../mru/mru.pdf ./mru-whitepaper.pdf
git add mru-whitepaper.pdf && git commit -m "Add whitepaper PDF" && git push
```

Keep the path `/mru-whitepaper.pdf` **stable forever** — the PDF itself
hard-codes `https://mru.systems` as its home.

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Push to the `main` branch of `mrusystems/website`.
2. Repo **Settings → Pages → Build and deployment → Source: Deploy from a
   branch**, branch `main` / `/ (root)`.
3. The `CNAME` file configures the custom domain `mru.systems`. In GitHub Pages
   settings, confirm the custom domain is `mru.systems` and **Enforce HTTPS** is
   checked.

### DNS (at your registrar / Cloudflare)

Point the apex `mru.systems` at GitHub Pages with **A / AAAA** records:

```
A     @   185.199.108.153
A     @   185.199.109.153
A     @   185.199.110.153
A     @   185.199.111.153
AAAA  @   2606:50c0:8000::153
AAAA  @   2606:50c0:8001::153
AAAA  @   2606:50c0:8002::153
AAAA  @   2606:50c0:8003::153
CNAME www mrusystems.github.io.
```

`www.mru.systems` then redirects to the apex automatically via GitHub Pages.

### Email (contact@mru.systems)

Set up **Cloudflare Email Routing** (free): add the MX/TXT records it provides
and forward `contact@mru.systems` → your real inbox.

## Editing the OG image

Edit `assets/og-source.svg`, then regenerate:

```sh
magick -background none assets/og-source.svg assets/og-image.png
```

## License

- Site content & whitepaper: **CC BY 4.0**
- Reference implementation (`mru`, coming soon): **AGPL v3** (dual-licensed)
