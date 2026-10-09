#!/usr/bin/env python3
"""Animated Mru mark, in seamless variants. Needs ImageMagick and ffmpeg.

Geometry mirrors index.html / og-source.svg (100-unit viewBox, ring r=34,
orbit rx=30 ry=14 tilted -22 degrees, centred M). Every variant leaves the
ring, the ellipse and the M where the logo puts them and adds motion around
them. Every variant closes on its own first frame.

  dial       mark only. A hairline track outside the ring fills once per loop
             while the bead laps ten times, so one lap reads as a century.
  orrery     three nested orbits, beads at 2, 3 and 5 laps. They leave the
             start line together, scatter, and return together at the close.
             The period of the whole system is the loop.
  armillary  three orbits at different tilts, counter-rotating. The mark's own
             ellipse holds its angle while the other two sweep through it.
  trace      one orbit, precessing, and the bead's path persists as a long
             exposure. Starts on a bare mark, draws, and fades back to the same
             bare mark, with the changeover kept to a few frames.
  classic    the full lockup holds still, a bead rides the orbit. 6s, one lap.
  precess    the orbit ellipse turns inside the ring, the bead rides with it.

The mark is drawn in one of two palettes, matching the site's light and dark
themes. The dark trace variant publishes as mru.gif / mru.mp4, the light one as
mru-light.gif / mru-light.mp4; everything else keeps its logo-loop-* name.

Usage: _gen_logo_anim.py [name|all] [dark|light|both]
"""
import math, os, subprocess, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_JOST = os.path.join(HERE, "jost.ttf")
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"

W = H = 1080
FPS = 30

# The site's two palettes, mirroring the :root blocks in index.html. Light is
# not a negative of dark: the page has no glow in light mode, and the trace
# plate has to darken the paper rather than light it up, so it carries its own
# blend. Nothing here changes the geometry.
THEMES = {
    "dark": dict(
        ink="#ecece8", bg="#121214", faint="#8f8f8a", glow="#7c8caa",
        glow_op=0.16, blend="screen", pen="#ecece8", trace_gain=1.0),
    "light": dict(
        ink="#16161a", bg="#fafaf8", faint="#6f6f78", glow=None,
        glow_op=0.0, blend="multiply", pen="white", trace_gain=0.914),
}

INK = BG = FAINT = GLOW = PEN = BLEND = None
GLOW_OP = TRACE_GAIN = 0.0


def use_theme(name):
    """Point the drawing code at one palette. build() calls this first."""
    global INK, BG, FAINT, GLOW, GLOW_OP, BLEND, PEN, TRACE_GAIN
    t = THEMES[name]
    INK, BG, FAINT, GLOW = t["ink"], t["bg"], t["faint"], t["glow"]
    GLOW_OP, BLEND, PEN, TRACE_GAIN = t["glow_op"], t["blend"], t["pen"], t["trace_gain"]


use_theme("dark")

WORD_SIZE, WORD_BASE = 170, 712
DOM_SIZE, DOM_BASE, DOM_KERN = 26, 800, 4

MARK = (9.6, 540.0, 540.0)      # mark alone, filling the frame
LOCKUP = (3.4, 540.0, 370.0)    # mark over the wordmark and the domain


def orbit(rx=30.0, ry=14.0, tilt=-22.0, spin=0.0, op=1.0):
    """One ellipse, in mark units. spin is degrees turned over a whole loop;
    a multiple of 180 returns the ellipse to itself, which keeps the loop shut."""
    return dict(rx=rx, ry=ry, tilt=tilt, spin=spin, op=op)


def bead(on=0, laps=1, size=1.0, phase=0.0):
    return dict(on=on, laps=laps, size=size, phase=phase)


VARIANTS = {
    "dial": dict(
        geom=MARK, seconds=12, lockup=False, dial=True, trace=False, align=False,
        orbits=[orbit()], beads=[bead(laps=10)],
        mp4_loops=0, gif_fps=20, gif_colors=128),
    "orrery": dict(
        geom=MARK, seconds=12, lockup=False, dial=False, trace=False, align=True,
        orbits=[orbit(), orbit(24.5, 11.4, op=0.20), orbit(19.0, 8.9, op=0.20)],
        beads=[bead(0, 2, 1.00), bead(1, 3, 0.85), bead(2, 5, 0.72)],
        mp4_loops=0, gif_fps=20, gif_colors=128),
    "armillary": dict(
        geom=MARK, seconds=12, lockup=False, dial=False, trace=False, align=False,
        orbits=[orbit(), orbit(30, 6, 38, 180, 0.26), orbit(30, 22, 102, -180, 0.26)],
        beads=[bead(0, 2, 1.00), bead(1, 3, 0.62), bead(2, 5, 0.62)],
        mp4_loops=0, gif_fps=20, gif_colors=128),
    "trace": dict(
        geom=MARK, seconds=12, lockup=False, dial=False, trace=True, align=False,
        orbits=[orbit(spin=360.0)], beads=[bead(laps=12)],
        mp4_loops=0, gif_fps=20, gif_colors=160, publish="mru", flat=True),
    "classic": dict(
        geom=LOCKUP, seconds=6, lockup=True, dial=False, trace=False, align=False,
        orbits=[orbit()], beads=[bead(laps=1)],
        mp4_loops=1, gif_fps=25, gif_colors=160),
    "precess": dict(
        geom=LOCKUP, seconds=10, lockup=True, dial=False, trace=False, align=False,
        orbits=[orbit(spin=360.0)], beads=[bead(laps=2)],
        mp4_loops=0, gif_fps=20, gif_colors=128),
}

# dial track, in mark units: the ring's outer edge sits at 35.2, so this clears it
DIAL_R = 39.0
TICK_IN, TICK_OUT = 37.0, 41.0
TICKS = 10
FADE_FROM = 0.93        # the completed track clears over the last stretch
FLASH = (0.895, 0.945)  # and brightens a little as it closes

TRACE_DECAY = 0.9880    # per frame, while a stroke is still on the plate
TRACE_PEN_ON = (0.00, 0.10)   # the pen touches down across this stretch, so the
                              # oldest stroke tapers away instead of ending on a
                              # cut while it is still too young to have decayed.
                              # Must span more than one lap of the bead, or the
                              # taper finishes inside a single arc and reads as
                              # a stray hair rather than as a line fading out.
                              # It never lifts: the plate is discarded at the
                              # loop end anyway, and drawing to the last frame
                              # keeps the web live while it dims instead of
                              # leaving a frozen picture to fade.
TRACE_FADE = (0.50, 1.00)     # across which the plate goes to nothing, so the
                              # last frame is the bare mark the first frame is.
                              # Half the loop: the web should be visibly going
                              # the whole way out, not dumped in the last second.


class Geom:
    """The 100-unit mark placed on the canvas at a given scale and centre."""

    def __init__(self, scale, cx, cy):
        self.s, self.cx, self.cy = scale, cx, cy
        self.r_ring = self.px(34)
        self.sw_ring = self.px(2.4)
        self.sw_orb = self.px(1.4)
        self.m_size = self.px(16) * 1.34   # magick pointsize vs svg font-size

    def px(self, u):
        return u * self.s

    def X(self, u):
        return self.cx + (u - 50.0) * self.s

    def Y(self, u):
        return self.cy + (u - 50.0) * self.s


def run(cmd):
    subprocess.run(cmd, check=True)


def text_width(font, size, kern, text):
    out = subprocess.run(
        ["magick", "-font", font, "-pointsize", str(size), "-kerning", str(kern),
         "label:" + text, "-format", "%w", "info:"],
        capture_output=True, text=True, check=True)
    return int(out.stdout.strip())


def _smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def align_flash(t):
    """Peaks where the beads meet at the loop seam, and reads the same on
    either side of it, so the wrap lands mid-beat instead of on a cut."""
    d = min(t, 1.0 - t)
    return (1.0 - _smoothstep(d / 0.06)) * 0.45


def build_base(g, path, lockup, flat=False):
    """Everything that never moves: bg + glow + ring (+ wordmark + domain).

    flat is for the variants that ship onto the site. index.html draws its own
    glow behind the hero, so the art must not carry a second one, and it must
    not carry the page colour either: any opaque backdrop shows up as a tile
    over that glow. Instead the frame is laid on the blend-neutral colour for
    the theme (black under screen, white under multiply) and the page composites
    it with the matching mix-blend-mode. On a dark page screen over black and on
    a light page multiply over white both come out equal to painting the ink
    straight onto whatever is behind it, so the frame edge disappears."""
    backdrop = ("black" if BLEND == "screen" else "white") if flat else BG
    cmd = ["magick", "-size", f"{W}x{H}", f"xc:{backdrop}"]
    if GLOW and not flat:
        # faint depth glow, mirrors the site's radial-gradient
        cmd += [
            "(", "-size", f"{W}x{H}", f"radial-gradient:{GLOW}-{BG}",
                 "-gravity", "center", "-crop", f"{W}x{H}+0+0", "+repage",
                 "-alpha", "set", "-channel", "A",
                 "-evaluate", "multiply", f"{GLOW_OP}", "+channel", ")",
            "-compose", "over", "-composite"]
    cmd += [
        # ring
        "-fill", "none", "-stroke", INK, "-strokewidth", f"{g.sw_ring:.2f}",
        "-draw", f"circle {g.X(50):.1f},{g.Y(50):.1f} {g.X(50):.1f},{g.Y(50)-g.r_ring:.1f}",
        "-stroke", "none", "-fill", INK, "-font", FONT_JOST]
    if lockup:
        word_w = text_width(FONT_JOST, WORD_SIZE, 0, "Mru")
        dom_w = text_width(FONT_MONO, DOM_SIZE, DOM_KERN, "mru.space")
        cmd += [
            "-gravity", "none", "-pointsize", str(WORD_SIZE), "-kerning", "0",
            "-annotate", f"+{(W - word_w)//2}+{WORD_BASE}", "Mru",
            "-font", FONT_MONO, "-fill", FAINT, "-pointsize", str(DOM_SIZE),
            "-kerning", str(DOM_KERN),
            "-annotate", f"+{(W - dom_w)//2}+{DOM_BASE}", "mru.space"]
    run(cmd + [path])


def orbit_point(g, o, t, laps, phase):
    """t in [0,1) -> (x, y, depth) for a bead on orbit o. depth 0=far, 1=near.

    Depth stays tied to the ellipse's own frame, so the near half of an orbit
    turns with the ellipse instead of snapping when it passes the vertical.
    """
    a = 2 * math.pi * (laps * t + phase)
    ex, ey = g.px(o["rx"]) * math.cos(a), g.px(o["ry"]) * math.sin(a)
    th = math.radians(o["tilt"] + o["spin"] * t)
    x = g.X(50) + ex * math.cos(th) - ey * math.sin(th)
    y = g.Y(50) + ex * math.sin(th) + ey * math.cos(th)
    return x, y, (math.sin(a) + 1) / 2


def orbits_draw(g, t, orbits):
    """Every ellipse at its angle for this frame, faintest first."""
    parts = [f"fill none stroke {INK}"]
    for o in sorted(orbits, key=lambda o: o["op"]):
        parts.append(f"stroke-width {g.sw_orb:.2f} stroke-opacity {o['op']:.3f} "
                     f"translate {g.X(50):.1f},{g.Y(50):.1f} "
                     f"rotate {o['tilt'] + o['spin'] * t:.3f} "
                     f"ellipse 0,0 {g.px(o['rx']):.1f},{g.px(o['ry']):.1f} 0,360 "
                     f"rotate {-(o['tilt'] + o['spin'] * t):.3f} "
                     f"translate {-g.X(50):.1f},{-g.Y(50):.1f}")
    return " ".join(parts)


def beads_draw(g, t, v):
    """Each bead, plus a fading comet trail along the path it actually took."""
    parts = ["stroke none"]
    boost = align_flash(t) if v["align"] else 0.0
    for b in v["beads"]:
        o = v["orbits"][b["on"]]
        trail, lag = 40, 0.0065 / b["laps"]
        for k in range(trail, 0, -1):
            x, y, d = orbit_point(g, o, t - k * lag, b["laps"], b["phase"])
            f = 1 - k / (trail + 1.0)
            op = (f ** 2.4) * (0.45 + 0.55 * d) * 0.72 * b["size"]
            r = g.px(0.35 + 1.15 * f) * (0.72 + 0.28 * d) * b["size"]
            if op < 0.012:
                continue
            parts.append(f"fill-opacity {op:.3f} circle {x:.2f},{y:.2f} {x+r:.2f},{y:.2f}")
        x, y, d = orbit_point(g, o, t, b["laps"], b["phase"])
        r = g.px(2.0) * (0.76 + 0.24 * d) * b["size"]
        halo = (1.0 + boost)
        parts.append(f"fill-opacity {min(1.0,(0.09+0.09*d)*halo):.3f} "
                     f"circle {x:.2f},{y:.2f} {x+r*3.0:.2f},{y:.2f}")
        parts.append(f"fill-opacity {min(1.0,(0.20+0.14*d)*halo):.3f} "
                     f"circle {x:.2f},{y:.2f} {x+r*1.7:.2f},{y:.2f}")
        parts.append(f"fill-opacity 1.0 circle {x:.2f},{y:.2f} {x+r:.2f},{y:.2f}")
    return " ".join(parts)


def _polar(g, radius_u, deg):
    """Mark-unit radius and a clock angle (0 = twelve, clockwise) -> canvas xy."""
    a = math.radians(deg - 90.0)
    return g.X(50) + g.px(radius_u) * math.cos(a), g.Y(50) + g.px(radius_u) * math.sin(a)


def dial_draw(g, t):
    """The millennium track: faint circle, filled arc, ten century ticks.

    The arc grows through the whole loop and the whole dial fades out at the
    end, so the wrap lands on an invisible full track meeting an invisible
    empty one. The bead's laps stay phase-locked to the ticks because both
    run straight off t.
    """
    fade = 1.0 - _smoothstep((t - FADE_FROM) / (1.0 - FADE_FROM))
    flash = _smoothstep((t - FLASH[0]) / (FLASH[1] - FLASH[0])) * \
            (1.0 - _smoothstep((t - FLASH[1]) / (1.0 - FLASH[1]))) * 0.45

    parts = [f"fill none stroke {INK} stroke-linecap round"]
    r = g.px(DIAL_R)
    top, bot = _polar(g, DIAL_R, 0), _polar(g, DIAL_R, 180)

    # the empty track it fills against (two half arcs; one arc cannot close)
    parts.append(f"stroke-width {g.px(0.5):.2f} stroke-opacity 0.13 "
                 f"path 'M {top[0]:.1f},{top[1]:.1f} "
                 f"A {r:.1f},{r:.1f} 0 1 1 {bot[0]:.1f},{bot[1]:.1f} "
                 f"A {r:.1f},{r:.1f} 0 1 1 {top[0]:.1f},{top[1]:.1f}'")

    # the arc travelled so far
    swept = min(359.4, 360.0 * t)
    if swept > 0.6:
        end = _polar(g, DIAL_R, swept)
        large = 1 if swept > 180 else 0
        parts.append(f"stroke-width {g.px(0.9):.2f} "
                     f"stroke-opacity {min(1.0, (0.82 + flash) * fade):.3f} "
                     f"path 'M {top[0]:.1f},{top[1]:.1f} "
                     f"A {r:.1f},{r:.1f} 0 {large} 1 {end[0]:.1f},{end[1]:.1f}'")

    # century ticks, lighting as the sweep passes each one
    parts.append("stroke-linecap butt")
    for i in range(TICKS):
        deg = 360.0 * i / TICKS
        lit = _smoothstep((t - i / TICKS) / 0.02)
        op = 0.14 + (0.76 + flash) * lit * fade
        x1, y1 = _polar(g, TICK_IN, deg)
        x2, y2 = _polar(g, TICK_OUT, deg)
        parts.append(f"stroke-width {g.px(0.7 if i else 1.1):.2f} "
                     f"stroke-opacity {min(1.0, op):.3f} "
                     f"line {x1:.1f},{y1:.1f} {x2:.1f},{y2:.1f}")
    return " ".join(parts)


def trace_step(g, acc, t, prev_t, v):
    """Lay this frame's sliver of bead path onto the long exposure, after
    dimming what is already there. The pen eases down at the start and then
    writes without stopping; trace_vis does the fading, so the web is still
    being drawn while it dims. What disappears is the record of the bead,
    never the bead."""
    cmd = ["magick", acc, "-evaluate", "multiply", f"{TRACE_DECAY:.4f}"]
    ink = 0.62 * _smoothstep(
        (t - TRACE_PEN_ON[0]) / (TRACE_PEN_ON[1] - TRACE_PEN_ON[0]))
    if ink > 0.004:
        b, o = v["beads"][0], v["orbits"][0]
        steps = 12
        pts = [orbit_point(g, o, prev_t + (t - prev_t) * i / steps, b["laps"], b["phase"])
               for i in range(steps + 1)]
        # one unbroken path for the whole sliver. Per-segment opacity beaded the
        # line; the depth shading is slow enough to carry at frame resolution.
        depth = sum(p[2] for p in pts) / len(pts)
        d = "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y, _ in pts)
        cmd += ["-draw", f"fill none stroke {PEN} stroke-linecap round "
                         f"stroke-linejoin round stroke-width {g.px(0.5):.2f} "
                         f"stroke-opacity {ink * (0.45 + 0.55 * depth):.3f} path '{d}'"]
    run(cmd + [acc])


def trace_vis(t):
    """How much of the plate is showing, over the fade window.

    Not a smoothstep, and not linear. A smoothstep leaves with zero velocity,
    so its last sixth sits under the visible floor: the web looks gone while
    the clock says it is still fading, and that is dead air before the next one
    starts. A power just under 1 declines almost evenly across the window and
    then runs the last stretch off steeply, so it is under the floor for only
    the final 3%, which over this window is about two tenths of a second."""
    x = (t - TRACE_FADE[0]) / (TRACE_FADE[1] - TRACE_FADE[0])
    return (1.0 - max(0.0, min(1.0, x))) ** 0.8


def frame(g, base, out, t, v, acc=None):
    """orbits, then the M over them, then the dial, then the beads."""
    cmd = ["magick", base]
    if acc and trace_vis(t) > 0.003:
        vis = trace_vis(t) * TRACE_GAIN
        # The plate holds exposure, not colour. On dark, screening it in adds
        # light. On light there is no light to add, so invert the scaled plate
        # into a multiply mask and let it pull the paper down towards the ink.
        neg = ["-negate"] if BLEND == "multiply" else []
        cmd += ["(", acc, "-evaluate", "multiply", f"{vis:.4f}"] + neg + [")",
                "-compose", BLEND, "-composite", "-compose", "over"]
    cmd += ["-draw", orbits_draw(g, t, v["orbits"]),
        "-stroke", "none", "-fill", INK, "-font", FONT_JOST,
        "-pointsize", f"{g.m_size:.1f}", "-gravity", "center",
        "-annotate", f"+0+{g.cy - H/2 + g.px(2.0):.0f}", "M",
        "-gravity", "none"]
    if v["dial"]:
        cmd += ["-draw", dial_draw(g, t)]
    cmd += ["-fill", INK, "-draw", beads_draw(g, t, v), out]
    run(cmd)


def build(name, theme="dark"):
    v = VARIANTS[name]
    use_theme(theme)
    g = Geom(*v["geom"])
    suffix = "" if name == "classic" else f"-{name}"
    stem = v.get("publish") or f"logo-loop{suffix}"
    if theme != "dark":
        stem += f"-{theme}"
    mp4 = os.path.join(HERE, f"{stem}.mp4")
    gif = os.path.join(HERE, f"{stem}.gif")
    frames = FPS * v["seconds"]
    tmp = tempfile.mkdtemp(prefix=f"mru-logo-{name}-")
    try:
        base = os.path.join(tmp, "base.png")
        build_base(g, base, v["lockup"], v.get("flat", False))
        acc = None
        if v["trace"]:
            acc = os.path.join(tmp, "acc.png")
            run(["magick", "-size", f"{W}x{H}", "xc:black", acc])
        for i in range(frames):
            t = i / frames
            if acc:
                trace_step(g, acc, t, (i - 1) / frames, v)
            frame(g, base, os.path.join(tmp, f"f{i:04d}.png"), t, v, acc)
        seq = os.path.join(tmp, "f%04d.png")

        # MP4. The grain + gradfun pass keeps the dark backdrop from banding
        # under h264. The silent audio track avoids picky uploaders.
        run(["ffmpeg", "-y", "-v", "error",
             "-stream_loop", str(v["mp4_loops"]), "-framerate", str(FPS), "-i", seq,
             "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
             "-vf", "gradfun=strength=1.2:radius=16,noise=alls=3:allf=t+u,format=yuv420p",
             "-c:v", "libx264", "-preset", "slow", "-crf", "16",
             "-profile:v", "high", "-level", "4.0",
             "-c:a", "aac", "-b:a", "128k", "-shortest",
             "-movflags", "+faststart", mp4])

        # GIF: one loop, built from the clean frames (grain would wreck both
        # the palette and the interframe deltas).
        run(["ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-i", seq,
             "-vf", (f"fps={v['gif_fps']},scale=600:600:flags=lanczos,split[a][b];"
                     f"[a]palettegen=max_colors={v['gif_colors']}:stats_mode=diff[p];"
                     "[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle"),
             "-loop", "0", gif])

        if v.get("flat"):
            # ffmpeg's palette lands the flat backdrop a shade off pure, and a
            # shade off is enough to tint the page inside the frame once the
            # blend mode is on it. Snap the extreme back, and let the layer
            # optimiser drop what does not change between frames: on this art
            # that is most of the picture, so the file roughly halves.
            pure = "white" if BLEND == "multiply" else "black"
            run(["magick", gif, "-fuzz", "2%", "-fill", pure, "-opaque", pure,
                 "-layers", "optimize", gif])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"{name}/{theme}: {os.path.basename(mp4)}, {os.path.basename(gif)}")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    theme = sys.argv[2] if len(sys.argv) > 2 else "dark"
    for t in (THEMES if theme == "both" else [theme]):
        for n in (VARIANTS if which == "all" else [which]):
            build(n, t)
