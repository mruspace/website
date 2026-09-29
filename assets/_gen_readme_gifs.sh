#!/bin/sh
# README-sized copies of the animated mark, for GitHub. Needs ImageMagick and
# gifsicle. Run from this directory after regenerating mru.gif / mru-light.gif.
#
# A GIF has no alpha, and GitHub cannot blend it the way the site does, so the
# dark art is screened onto GitHub's dark page colour (#0d1117) here instead.
# The light art already sits on white, which is GitHub's light page colour.
# 240px keeps the mark sharp at the 120px the READMEs show it.
set -e
mkdir -p readme
magick mru.gif -coalesce null: \( -size 600x600 xc:'#0d1117' \) -compose screen \
  -layers composite -resize 240x240 -layers optimize readme/mru-github-dark.gif
magick mru-light.gif -coalesce -resize 240x240 -layers optimize readme/mru-github-light.gif
# Cutting the palette to 64 colours can nudge the backdrop a step off the page
# colour (254 instead of 255), which shows as a faint square. Snap it back.
for v in dark:0d1117 light:ffffff; do
  name=${v%%:*} page=${v#*:}
  f=readme/mru-github-$name.gif
  gifsicle -O3 --lossy=30 --colors 64 -b "$f"
  bg=$(magick "$f[0]" -format '%[hex:p{0,0}]' info: | cut -c1-6 | tr 'A-F' 'a-f')
  [ "$bg" = "$page" ] || gifsicle -b --change-color "#$bg" "#$page" "$f"
done
