#!/usr/bin/env python3
"""C1 — the bead calibration WEFT has never had on the Creality.

Everything WEFT computes is derived from ONE number: the width of a single deposited line. rho, the
rung-tip floor, self-approach, weld spacing, the bridge budget, what counts as supported — all of it.
For the Bambu that number was measured (0.45, from the D5 dome and Šuma 2×2). For the Ender it has
only ever been assumed (0.42), which means every check that machine has passed was measured against
a number nobody had ever seen in plastic.

This prints five single-wall tubes, each COMMANDED at a different width. Nothing is sliced: the
extrusion is computed here from the stadium cross-section WEFT itself uses,

    A = h*(w - h) + pi*(h/2)^2        E_per_mm = A / (pi * (1.75/2)^2)

so what comes out of the nozzle is exactly what WEFT thinks it is asking for. Measure each wall with
calipers. The one whose measured thickness matches its commanded width is the machine's bead; put
that number in machines.json and set beadSource to "measured".

The towers are DIFFERENT HEIGHTS, ascending with width, so the plate cannot be read the wrong way
round: shortest = narrowest.

usage: python c1_calibration.py --out C1_ender.gcode [--head exports/ender_start.gcode] [--foot ...]
"""
import argparse, math

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='C1_ender.gcode')
ap.add_argument('--head', default='exports/ender_start.gcode')
ap.add_argument('--foot', default='exports/ender_end.gcode')
ap.add_argument('--widths', default='0.36,0.40,0.44,0.48,0.52')
ap.add_argument('--side', type=float, default=18.0)      # outer side of the square tube
ap.add_argument('--corner', type=float, default=3.0)
ap.add_argument('--pitch', type=float, default=32.0)     # centre-to-centre spacing
ap.add_argument('--lh', type=float, default=0.20)
ap.add_argument('--lh1', type=float, default=0.30)   # matches the purge height in the start block:
                                                     # a first layer BELOW it is a Z that goes down
ap.add_argument('--pad', type=float, default=26.0)   # solid base under each tower
ap.add_argument('--padw', type=float, default=0.48)  # first-layer line width
ap.add_argument('--h0', type=float, default=8.0)         # height of the shortest tower
ap.add_argument('--dh', type=float, default=1.0)         # each tower this much taller than the last
ap.add_argument('--speed', type=float, default=15.0)
ap.add_argument('--speed1', type=float, default=12.0)

ap.add_argument('--temp', type=float, default=215)
ap.add_argument('--bed', type=float, default=60)
ap.add_argument('--bx', type=float, default=220)
ap.add_argument('--by', type=float, default=220)
a = ap.parse_args()

FIL = math.pi * (1.75 / 2) ** 2


def e_per_mm(w, h):
    """stadium cross-section — the same model printllm and WEFT both use"""
    return (h * (w - h) + math.pi * (h / 2) ** 2) / FIL


def solid_pad(cx, cy, side, r, w):
    """A FILLED base, not a ring. Five single-wall towers standing on four loops of brim have about
       150 mm2 of contact each; on a bed nobody has levelled for this job that is a coin toss, and a
       tower that lets go halfway costs the whole calibration. Concentric rounded squares from the
       outside in, spaced 0.92 of a line so they overlap: ~600 mm2 each, and it is its own brim."""
    loops = []
    step = w * 0.92
    half = side / 2
    rr = r
    while half > step:
        loops.append(rounded_square(cx, cy, 2 * half, min(rr, half - 0.01)))
        half -= step
        rr = max(0.2, rr - step)
    return loops


def rounded_square(cx, cy, side, r, n=8):
    """one closed loop, corners rounded so the nozzle never has to stop dead"""
    h = side / 2 - r
    pts = []
    for (sx, sy, a0) in ((+1, +1, 0.0), (-1, +1, math.pi / 2), (-1, -1, math.pi), (+1, -1, 3 * math.pi / 2)):
        for k in range(n + 1):
            t = a0 + (math.pi / 2) * k / n
            pts.append((cx + sx * h + r * math.cos(t), cy + sy * h + r * math.sin(t)))
    pts.append(pts[0])
    return pts


widths = [float(v) for v in a.widths.split(',')]
N = len(widths)
cx0 = a.bx / 2 - (N - 1) * a.pitch / 2
towers = []
for i, w in enumerate(widths):
    towers.append({'w': w, 'cx': cx0 + i * a.pitch, 'cy': a.by / 2,
                   'H': a.h0 + i * a.dh, 'layers': int(round((a.h0 + i * a.dh - a.lh1) / a.lh)) + 1})

# plate fit
minx = min(t['cx'] for t in towers) - a.pad / 2 - 2
maxx = max(t['cx'] for t in towers) + a.pad / 2 + 2
if minx < 8 or maxx > a.bx - 8:
    raise SystemExit(f'REFUSED: the row spans {minx:.1f}..{maxx:.1f} mm on a {a.bx:.0f} mm bed')

head = open(a.head, encoding='utf-8').read().replace('{TEMP}', str(int(a.temp))).replace('{BED}', str(int(a.bed)))
foot = open(a.foot, encoding='utf-8').read().replace('{TEMP}', str(int(a.temp))).replace('{BED}', str(int(a.bed)))

out = [head.rstrip(), '',
       '; ===== C1 bead calibration =====',
       f'; five single-wall tubes, commanded width {", ".join(f"{w:.2f}" for w in widths)} mm',
       f'; each stands on a SOLID {a.pad:.0f} x {a.pad:.0f} mm pad, first layer {a.lh1:.2f} mm at {a.padw:.2f} mm',
       '; SHORTEST tower = NARROWEST commanded width. Measure each wall with calipers.',
       '; extrusion from A = h(w-h) + pi(h/2)^2, filament 1.75 mm — no slicer decided anything here',
       '']

total_len = 0.0
maxlayer = max(t['layers'] for t in towers)
for li in range(maxlayer):
    z = a.lh1 + li * a.lh if li else a.lh1
    first = (li == 0)
    h = a.lh1 if first else a.lh
    spd = a.speed1 if first else a.speed
    live = [t for t in towers if li < t['layers']]
    if not live:
        break
    out.append(f'; layer {li} wall')
    out.append(f'G1 Z{z:.3f} F600')
    for t in live:
        w = a.padw if first else t['w']
        epm = e_per_mm(w, h)
        loops = (solid_pad(t['cx'], t['cy'], a.pad, 5.0, a.padw) if first
                 else [rounded_square(t['cx'], t['cy'], a.side, a.corner)])
        for lp in loops:
            out.append(f'G0 X{lp[0][0]:.3f} Y{lp[0][1]:.3f} F9000')
            out.append('G1 E0.6 F1800')
            px, py = lp[0]
            for (qx, qy) in lp[1:]:
                d = math.hypot(qx - px, qy - py)
                total_len += d
                out.append(f'G1 X{qx:.3f} Y{qy:.3f} E{d*epm:.5f} F{spd*60:.0f}')
                px, py = qx, qy
            out.append('G1 E-0.6 F1800')

out += ['', f'; total extruded path {total_len/1000:.1f} m', '', foot.rstrip(), '']
open(a.out, 'w', encoding='utf-8').write('\n'.join(out))
print(f'{a.out}: {len(out)} lines, {maxlayer} layers, {total_len/1000:.1f} m of thread')
for t in towers:
    print(f"  commanded {t['w']:.2f} mm   x={t['cx']:.1f}   height {t['H']:.1f} mm   {t['layers']} layers")
print(f'  base: solid {a.pad:.0f}x{a.pad:.0f} mm pad per tower, first layer {a.lh1:.2f} mm')
print(f'  row spans {minx:.1f}..{maxx:.1f} mm on a {a.bx:.0f} mm bed')
