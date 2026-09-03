#!/usr/bin/env python3
"""Rewrite a packaged G-code's HEADER_BLOCK statistics from the file's own content.

The A2L start block WEFT ships was harvested from a D5 dome print, statistics and all. Every object
built on it therefore carried somebody else's numbers: the Suma 4x4 - 4.7 h, 57 mm tall, 236 layers -
went to the printer announcing `model printing time: 1d 1h 26m 54s`, `total layer number: 583`,
`total filament weight: 185.94 g`, `max_z_height: 139.88`. The machine showed that to Semir for the
whole print. A file that lies about itself in its first ten lines is not shippable, and no amount of
care further down makes up for it.

This reads the emitted moves and writes back what is actually there. The time is a kinematic estimate
from the commanded feedrates - it ignores acceleration, so it is a LOWER bound, and it says so.

usage: python fix_header.py FILE.gcode [--density 1.26] [--diameter 1.75] [--quiet]
"""
import argparse, math, re, sys

ap = argparse.ArgumentParser()
ap.add_argument('gcode')
ap.add_argument('--density', type=float, default=1.26)
ap.add_argument('--diameter', type=float, default=1.75)
ap.add_argument('--quiet', action='store_true')
a = ap.parse_args()

src = open(a.gcode, 'r', errors='ignore').read().split('\n')

X = Y = Z = 0.0
F = 3000.0
absE = True
Eprev = None
efil = 0.0            # mm of filament
seconds = 0.0
zs = set()
maxz = 0.0
layer_marks = 0
for ln in src:
    s = ln.strip()
    if s.startswith('M82'):
        absE = True
    elif s.startswith('M83'):
        absE = False
    elif s.startswith('; CHANGE_LAYER') or s.startswith(';LAYER_CHANGE'):
        layer_marks += 1
    if not (s.startswith('G0') or s.startswith('G1')):
        continue
    d = {}
    for t in s.split():
        if t and t[0] in 'XYZEF':
            try:
                d[t[0]] = float(t[1:])
            except ValueError:
                pass
    if 'F' in d:
        F = d['F']
    nx, ny = d.get('X', X), d.get('Y', Y)
    nz = d.get('Z', Z)
    if 'E' in d:
        de = (d['E'] - Eprev) if (absE and Eprev is not None) else d['E']
        if absE:
            Eprev = d['E']
        if de > 0:
            efil += de
            if nz > maxz:
                maxz = nz
            zs.add(round(nz, 3))
    dist = math.hypot(nx - X, ny - Y)
    dist = math.hypot(dist, nz - Z)
    if dist > 0 and F > 0:
        seconds += dist / (F / 60.0)
    X, Y, Z = nx, ny, nz

vol = efil * math.pi * (a.diameter / 2.0) ** 2      # mm^3 (Bambu's field is mm^3 despite its cm^3 label)
grams = vol * a.density / 1000.0
nlayers = layer_marks if layer_marks else len(zs)


def hms(t):
    t = int(round(t))
    d, t = divmod(t, 86400)
    h, t = divmod(t, 3600)
    m, sec = divmod(t, 60)
    return (f'{d}d ' if d else '') + (f'{h}h ' if (h or d) else '') + f'{m}m {sec}s'


sub = {
    r'^; model printing time:.*$':
        f'; model printing time: {hms(seconds)}; total estimated time: {hms(seconds)}'
        f'   ; WEFT kinematic estimate, no acceleration model - a LOWER bound',
    r'^; total layer number:.*$': f'; total layer number: {nlayers}',
    r'^; total filament length \[mm\][^:]*:.*$': f'; total filament length [mm] : {efil:.2f}',
    r'^; total filament volume \[cm\^3\][^:]*:.*$': f'; total filament volume [cm^3] : {vol:.2f}',
    r'^; total filament weight \[g\][^:]*:.*$': f'; total filament weight [g] : {grams:.2f}',
    r'^; max_z_height:.*$': f'; max_z_height: {maxz:.2f}',
}
hit = {k: 0 for k in sub}
out = []
in_header = False
for ln in src:
    if ln.startswith('; HEADER_BLOCK_START'):
        in_header = True
    if in_header:
        for pat, rep in sub.items():
            if re.match(pat, ln):
                ln = rep
                hit[pat] += 1
                break
    if ln.startswith('; HEADER_BLOCK_END'):
        in_header = False
    out.append(ln)

open(a.gcode, 'w', newline='').write('\n'.join(out))
missed = [k for k, v in hit.items() if v == 0]
if not a.quiet:
    print(f'header rewritten: {nlayers} layers, {efil:.1f} mm filament, {grams:.1f} g, '
          f'max Z {maxz:.2f}, {hms(seconds)} (kinematic)')
    if missed:
        print(f'  NOTE: {len(missed)} header field(s) not present in this start block: '
              + ', '.join(m.strip("^$").replace("\\", "") for m in missed))
