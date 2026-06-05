#!/usr/bin/env python3
"""Generate the OG image SVG: minimal dark theme — faint glow, the Mru mark
(ring + tilted orbit + centred M), the wordmark, and the domain. The display
font (Jost, the open Futura revival) is embedded so the render is consistent."""

W, H = 1200, 630

# Jost-500 subset ("Mru"), inlined — same face the site uses.
JOST_B64 = ("d09GMgABAAAAAALcAA8AAAAABawAAAKFAAO1wwAAAAAAAAAAAAAAAAAAAAAAAAAAGhYbIBww"
            "BmA/U1RBVEQARBEICoFAgS4BNgIkAxALCgAEIAWDYAcgG40EIB6DbbN5hLEkl4xDCKccv7/"
            "xPPy4r3PfezMLMcGhwhlKVt4GlgI1Mu60VdoSp338/Bzr/Q215uIz/8MSVMiiiYQ3KjQxuX"
            "T5vF3+c/JN3EybnMgWjCUuTANfOhZwgoHObZ2n83/TkwYGr948NCSmVbtSBxCMBRQRVQSjz"
            "eUDbdhU1QQ2GvQBgtFWiEFafudxVKcE8DnVj2XwsU+DVvzyywDlZmkDtssgOSghHojFv+L4"
            "pQiAr1DNbDG9G7RVGQECGSofsRAhYqSCqQgsRVw9ymIEHL/ULyIvSDMRgoxCv1BFiTdAQEH"
            "FVKRgKgtrgJFGKthJZ/bpK+q/7N/v3xUAkT4TEA2MRMN6YBMADRBFRlu4TOtsb1r7nkN0l3"
            "3naALddi3ujp76fQvp11Y/jJl+sIu0Iyb+aOlfLNiDf/7WkPn9Yu2W/cOuXhvvffd99nkWX"
            "zlu56cwJFxvS+r4sTcrMC8hrCk1yf/T09NjA168mKkENTT0VscVhbWWiqfiTN+VJ5+oGYBz"
            "EOqrHwe195p6nbOGR5Lkd8CvSf8xAP73r2j8X2+fHK7fgEEFhG8RaqcACz6CF9Dyi7pdSAz"
            "FxV8xhGYvKxCsG+OmKs0WeMqUiOnWiWK8r0S1zLm32YgBs/3DB02PmwyBsQkL0BZNAr3QvH"
            "ne7FKlkEI1RsdhsDA/CeIG0U/TIkgxKygMOKyOTsGjDNZHz2fCWAqdwU8YFoapDBlixWJwM"
            "JZpQIxBCkksjmwIxYDpTIMwzgARJRo2RkWJPdwbfo1lq1GGcEySBhSGSdRPlyhGqnhxMnGw"
            "CJmp7GiwJVVn4ChkfmAlBWzlHkm3dUHlsH4izqAGCkk/GQn0tw4B")

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <style>
      @font-face {{
        font-family: "Jost Mru"; font-weight: 500; font-style: normal;
        src: url("data:font/woff2;base64,{JOST_B64}") format("woff2");
      }}
      .word {{ font-family: "Jost Mru", "Futura", sans-serif; font-weight: 500; }}
    </style>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#7c8caa" stop-opacity="0.16"/>
      <stop offset="70%" stop-color="#7c8caa" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="#121214"/>
  <rect width="{W}" height="{H}" fill="url(#glow)"/>
  <!-- mark: ring + tilted orbit + centred M -->
  <g transform="translate(541,166) scale(1.18)" fill="none" stroke="#ecece8">
    <circle cx="50" cy="50" r="34" stroke-width="2.4"/>
    <ellipse cx="50" cy="50" rx="30" ry="14" stroke-width="1.4" transform="rotate(-22 50 50)"/>
    <text class="word" x="50" y="55.6" text-anchor="middle" font-size="16" fill="#ecece8" stroke="none">M</text>
  </g>
  <!-- wordmark -->
  <text class="word" x="600" y="430" text-anchor="middle" font-size="150" fill="#ecece8">Mru</text>
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
