#!/usr/bin/env bash
# Regenerate the PNG icons for the Mru mark (ring + two nested triangles +
# centre ring). Drawn with ImageMagick primitives at 256px supersample, then
# downscaled for clean anti-aliasing. Mark geometry mirrors index.html / favicon.svg.
set -euo pipefail
cd "$(dirname "$0")/.."

draw_mark() {           # out  size  color  bg(none|#hex)
  local out=$1 size=$2 color=$3 bg=$4
  magick -size 256x256 "xc:$bg" \
    -fill none -stroke "$color" \
    -strokewidth 15.36 -draw "circle 128,128 128,41" \
    -strokewidth 7.68  -draw "stroke-linejoin round polygon 128,47.36 58.16,168.32 197.84,168.32" \
    -strokewidth 5.12  -draw "stroke-linejoin round polygon 128,89.6 94.75,147.2 161.25,147.2" \
    -strokewidth 3.84  -draw "stroke-linejoin round polygon 128,108.8 111.36,137.6 144.64,137.6" \
    -resize "${size}x${size}" "$out"
}

# Browser favicons: transparent, theme-matched (dark mark for light UI, light for dark UI).
draw_mark assets/favicon-light.png 64  "#16161a" none
draw_mark assets/favicon-dark.png  64  "#ecece8" none

# Home-screen / PWA icons: opaque dark plate with the light mark.
draw_mark apple-touch-icon.png     180 "#ecece8" "#121214"
draw_mark assets/icon-192.png      192 "#ecece8" "#121214"
draw_mark assets/icon-512.png      512 "#ecece8" "#121214"

echo "icons regenerated"
