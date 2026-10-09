// Share card renderer, 1200 × 630 PNG, from the Direction board's "Share card":
// always on ink, the mark and "Mru" top left, the card label in ochre mono,
// the OG title in Jost (Futura's open stand-in), the descent line along the
// foot. Shared with mruspace/docs (copied by its sync script).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const INK = '#121214';
const PAPER = '#ecece8';
const OCHRE = '#d8a54a';
const W = 1200;
const H = 630;

let fonts;
async function loadFonts() {
  if (!fonts) {
    // Resolved from the project root: inside an Astro build this module is
    // bundled, so import.meta.url no longer points here.
    const dir = path.resolve('scripts/og/fonts');
    fonts = [
      { name: 'Jost', data: await readFile(path.join(dir, 'jost-500.ttf')), weight: 500, style: 'normal' },
      { name: 'Plex Mono', data: await readFile(path.join(dir, 'ibm-plex-mono-500.ttf')), weight: 500, style: 'normal' },
    ];
  }
  return fonts;
}

const h = (type, style, children) => ({ type, props: { style, children } });

// The mark: ring, orbit at -22 degrees, the M. Geometry from favicon.svg,
// scaled from a 100-unit box to `size` px.
function mark(size) {
  const k = size / 100;
  return h('div', { position: 'relative', width: size, height: size, display: 'flex' }, [
    h('div', {
      position: 'absolute', left: 16 * k, top: 16 * k, width: 68 * k, height: 68 * k,
      borderRadius: '50%', border: `${2.4 * k}px solid ${PAPER}`,
    }),
    h('div', {
      position: 'absolute', left: 20 * k, top: 36 * k, width: 60 * k, height: 28 * k,
      borderRadius: '50%', border: `${1.4 * k}px solid ${PAPER}`, transform: 'rotate(-22deg)',
    }),
    h('div', {
      position: 'absolute', left: 0, top: 0, width: size, height: size, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Jost', fontSize: 16 * k,
      color: PAPER, paddingTop: 1 * k,
    }, 'M'),
  ]);
}

/** Title size steps down with length, so every title fits in four lines. */
function titleSize(t) {
  if (t.length <= 34) return 78;
  if (t.length <= 52) return 66;
  return 56;
}

export async function renderCard({ label, title }) {
  const size = titleSize(title);
  // Satori adds padding outside width and height, so give the inner size.
  const PAD = 72;
  const tree = h('div', {
    width: W - 2 * PAD, height: H - 2 * PAD, background: INK, color: PAPER, padding: PAD, display: 'flex',
    flexDirection: 'column', justifyContent: 'space-between',
  }, [
    h('div', { display: 'flex', alignItems: 'center', gap: 24, fontFamily: 'Jost', fontSize: 47 }, [mark(74), 'Mru']),
    h('div', { display: 'flex', flexDirection: 'column' }, [
      h('div', {
        fontFamily: 'Plex Mono', fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', color: OCHRE,
        marginBottom: 20,
      }, label),
      h('div', {
        fontFamily: 'Jost', fontSize: size, lineHeight: 1.05, maxWidth: size >= 78 ? 760 : 920,
      }, title),
    ]),
    // The descent line: ochre for 78% of the width, then nothing.
    h('div', { height: 3, width: '100%', display: 'flex' }, [
      h('div', { height: 3, width: '78%', background: OCHRE, opacity: 0.9 }),
    ]),
  ]);
  const svg = await satori(tree, { width: W, height: H, fonts: await loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}

/** /og/<route>.png for a page path: "/" → "/og/index.png", "/field/" → "/og/field.png". */
export function cardPath(pathname) {
  const p = pathname.replace(/^\/|\/$/g, '');
  return `/og/${p || 'index'}.png`;
}
