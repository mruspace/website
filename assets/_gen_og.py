#!/usr/bin/env python3
"""Generate the OG image SVG: minimal dark theme — a faint depth glow, the
circle mark, the wordmark, and the domain. No stars, no tagline."""

W, H = 1200, 630

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#7c8caa" stop-opacity="0.16"/>
      <stop offset="70%" stop-color="#7c8caa" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="#121214"/>
  <rect width="{W}" height="{H}" fill="url(#glow)"/>
  <!-- maru mark -->
  <circle cx="600" cy="225" r="33" fill="none" stroke="#ecece8" stroke-width="5"/>
  <line x1="600" y1="192" x2="600" y2="258" stroke="#ecece8" stroke-width="2" opacity="0.4"/>
  <!-- wordmark -->
  <text x="600" y="425" text-anchor="middle" font-family="Charter, 'Source Serif 4', 'Iowan Old Style', Palatino, Georgia, serif" font-size="160" fill="#ecece8" letter-spacing="1">Mru</text>
  <!-- domain -->
  <text x="600" y="540" text-anchor="middle" font-family="ui-monospace, 'SF Mono', Menlo, monospace" font-size="23" fill="#8f8f8a" letter-spacing="3">mru.systems</text>
</svg>
'''

with open("assets/og-source.svg", "w") as f:
    f.write(svg)

# HTML wrapper for a pixel-exact headless render (no body margins).
html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;padding:0;background:#121214}}
svg{{display:block}}
</style></head><body>
{svg}
</body></html>'''
with open("og-render.html", "w") as f:
    f.write(html)

print("wrote assets/og-source.svg and og-render.html")
