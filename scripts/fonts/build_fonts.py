#!/usr/bin/env python3
"""Build the self-hosted WOFF2 subsets in public/fonts/.

Sources are the OFL files from github.com/google/fonts. They are downloaded
into a cache folder and are not committed. Needs: fonttools, brotli.

    python3 -m venv .venv-fonts && .venv-fonts/bin/pip install fonttools brotli
    .venv-fonts/bin/python scripts/fonts/build_fonts.py
"""

from __future__ import annotations

import pathlib
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "fonts"
OUT = ROOT / "public" / "fonts"
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl"

SOURCES = {
    "jost": f"{BASE}/jost/Jost%5Bwght%5D.ttf",
    "serif": f"{BASE}/sourceserif4/SourceSerif4%5Bopsz,wght%5D.ttf",
    "serif-italic": f"{BASE}/sourceserif4/SourceSerif4-Italic%5Bopsz,wght%5D.ttf",
    "mono-400": f"{BASE}/ibmplexmono/IBMPlexMono-Regular.ttf",
    "mono-500": f"{BASE}/ibmplexmono/IBMPlexMono-Medium.ttf",
}

# Latin, Latin-1, the common Latin Extended-A letters, general punctuation,
# and every symbol the copy uses: · × № ′ ´ → ↗ − “ ” ’ § ° φ √ ™.
UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+0160-0161,U+0178,U+017D-017E,"
    "U+02C6,U+02DA,U+02DC,U+03C6,U+2000-206F,U+2116,U+2122,U+2190-2199,"
    "U+2212,U+221A,U+2248,U+2264-2265"
)

# (output name, source key, axis limits for a static or narrowed instance)
BUILDS = [
    ("jost-400", "jost", {"wght": 400}),
    ("jost-500", "jost", {"wght": 500}),
    ("jost-600", "jost", {"wght": 600}),
    # Source Serif 4 keeps its optical-size axis, as the canvas loaded it (opsz 8..60).
    ("source-serif-4-400", "serif", {"wght": 400, "opsz": (8, 60)}),
    ("source-serif-4-600", "serif", {"wght": 600, "opsz": (8, 60)}),
    ("source-serif-4-400-italic", "serif-italic", {"wght": 400, "opsz": (8, 60)}),
    ("ibm-plex-mono-400", "mono-400", None),
    ("ibm-plex-mono-500", "mono-500", None),
]


def fetch(key: str) -> pathlib.Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{key}.ttf"
    if not path.exists():
        with urllib.request.urlopen(SOURCES[key]) as r:  # noqa: S310 (fixed https URLs)
            path.write_bytes(r.read())
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    unicodes = subset.parse_unicodes(UNICODES)
    for name, key, limits in BUILDS:
        font = TTFont(fetch(key))
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.notdef_outline = True
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=unicodes)
        sub.subset(font)
        # Subset first, then pin the axes: instancing a full variable font
        # first leaves glyph variations the subsetter cannot match.
        if limits:
            font = instancer.instantiateVariableFont(font, limits)
        out = OUT / f"{name}.woff2"
        font.flavor = "woff2"
        font.save(out)
        print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
