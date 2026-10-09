#!/usr/bin/env bash
# Regenerate the PNG icons for the Mru mark: ring + tilted orbit ellipse + a
# centred "M" (Jost, the embedded Futura revival). Drawn at 256px supersample,
# downscaled for clean anti-aliasing. Geometry mirrors index.html / favicon.svg.
set -euo pipefail
cd "$(dirname "$0")/.."
FONT="assets/jost.ttf"   # matches the inlined web font

draw_mark() {           # out  size  color  bg(none|#hex)
  local out=$1 size=$2 color=$3 bg=$4
  magick -size 256x256 "xc:$bg" \
    -fill none -stroke "$color" -strokewidth 6.14 -draw "circle 128,128 128,41" \
    -strokewidth 3.58 -draw "translate 128,128 rotate -22 ellipse 0,0 76.8,35.84 0,360" \
    -fill "$color" -stroke none -font "$FONT" -pointsize 41 -gravity center -annotate +0+2 "M" \
    -resize "${size}x${size}" "$out"
}

# Browser favicons: transparent, theme-matched (dark mark for light UI, light for dark UI).
draw_mark assets/favicon-light.png 64  "#16161a" none
draw_mark assets/favicon-dark.png  64  "#ecece8" none

# Home-screen / PWA icons: opaque dark plate with the light mark.
draw_mark apple-touch-icon.png     180 "#ecece8" "#121214"
draw_mark assets/icon-192.png      192 "#ecece8" "#121214"
draw_mark assets/icon-512.png      512 "#ecece8" "#121214"

# Legacy / direct-request favicon.ico (multi-res, opaque dark plate). Covers
# crawlers and clients that request /favicon.ico regardless of <link> tags.
draw_mark /tmp/_mark256.png        256 "#ecece8" "#121214"
magick /tmp/_mark256.png -define icon:auto-resize=48,32,16 favicon.ico

echo "icons regenerated"
