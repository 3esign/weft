#!/usr/bin/env python3
"""Generate MERA: sixteen shallow, open WEFT instruments on one A2L plate.

The output is the level-1/2 geometry contract consumed by make_suma.mjs.  It is
analytic and stdlib-only: no mesh or raster approximation decides the local
contour, its normals, weld nodes, or the membrane path.

usage:
  python3 plate_geometry.py --out specimens/.../MERA_geometry.json \
      --svg specimens/.../MERA_plan.svg
"""
import argparse
import json
import math
from pathlib import Path


ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--svg')
ap.add_argument('--machine', default='a2l', choices=('a2l',))
ap.add_argument('--lh', type=float, default=0.24)
ap.add_argument('--bead', type=float, default=0.45)
ap.add_argument('--w', type=float, default=5.0)
ap.add_argument('--e', type=float, default=1.0)
ap.add_argument('--height', type=float, default=22.08)
a = ap.parse_args()

PITCH = 60.0
CENTERS = [((col - 1.5) * PITCH, (1.5 - row) * PITCH)
           for row in range(4) for col in range(4)]
N = int(round(a.height / a.lh))
H = N * a.lh
POINTS = 112
NODE_PITCH = 5.5
CAP_LAYER = 35                 # z=8.40; previous layer is a chord layer
CAP_PITCH = 0.36               # safely below 1.15 * the measured 0.45 bead


def sgn(v):
    return -1.0 if v < 0 else 1.0


def xy_shape(kind, t, rx, ry=None):
    """A small family of non-self-intersecting, photographically distinct contours."""
    ry = rx if ry is None else ry
    c, s = math.cos(t), math.sin(t)
    if kind == 'circle':
        return rx * c, ry * s
    if kind == 'ellipse':
        return rx * c, ry * s
    if kind == 'square':                 # rounded superellipse
        power = 0.5
        return rx * sgn(c) * abs(c) ** power, ry * sgn(s) * abs(s) ** power
    if kind == 'peanut':
        r = rx * (1.0 + 0.22 * math.cos(2.0 * t))
        return r * c, r * s
    if kind == 'clover':
        r = rx * (1.0 + 0.15 * math.cos(4.0 * t))
        return r * c, r * s
    raise ValueError(kind)


def contour(cx, cy, kind, rx, ry=None, **meta):
    q = []
    for i in range(POINTS):
        x, y = xy_shape(kind, 2.0 * math.pi * i / POINTS, rx, ry)
        q.append((cx + x, cy + y))
    # finite-difference tangent; right-hand normal of a CCW contour is outward
    normals = []
    for i in range(POINTS):
        x0, y0 = q[(i - 1) % POINTS]
        x1, y1 = q[(i + 1) % POINTS]
        tx, ty = x1 - x0, y1 - y0
        ll = math.hypot(tx, ty) or 1.0
        normals.append((ty / ll, -tx / ll))
    closed = q + [q[0]]
    nrms = normals + [normals[0]]
    cum = [0.0]
    for p, r in zip(closed, closed[1:]):
        cum.append(cum[-1] + math.hypot(r[0] - p[0], r[1] - p[1]))
    total = cum[-1]
    nk = max(12, int(round(total / NODE_PITCH)))
    if nk % 2:
        nk += 1
    nodes = [(j + 0.5) * total / nk for j in range(nk)]
    rec = {
        'pts': [[round(x, 3), round(y, 3)] for x, y in closed],
        'nrm': [[round(x, 5), round(y, 5)] for x, y in nrms],
        'cum': [round(v, 4) for v in cum],
        'total': round(total, 4),
        'nodes': [round(v, 4) for v in nodes],
    }
    rec.update(meta)
    return rec


def offset_ring(cx, cy, kind, scale, inward, n=96):
    """Offset a boundary along its local normal; a radius cannot answer a clover."""
    q = [xy_shape(kind, 2.0 * math.pi * i / n, scale) for i in range(n)]
    pts = []
    for i, (x, y) in enumerate(q):
        x0, y0 = q[(i - 1) % n]
        x1, y1 = q[(i + 1) % n]
        tx, ty = x1 - x0, y1 - y0
        ll = math.hypot(tx, ty) or 1.0
        nx, ny = ty / ll, -tx / ll
        pts.append([round(cx + x - nx * inward, 3), round(cy + y - ny * inward, 3)])
    pts.append(pts[0])
    return pts


def membrane(cx, cy, kind, outer, core):
    """One rim-first membrane anchored on the wall's inner chord rail."""
    path = []
    inward = a.w / 2.0
    while outer - inward > max(core, 0.25):
        ring = offset_ring(cx, cy, kind, outer, inward)
        if path:
            # same angle, one short radial stitch into the next turn
            path.append(ring[0])
        path.extend(ring)
        inward += CAP_PITCH
    if core <= 0.25:
        path.append([round(cx, 3), round(cy, 3)])
    else:
        path.extend(offset_ring(cx, cy, 'circle', core, 0.0, 48))
    return path


# One tile, one legible question.  Rows are: lean, grammar, membrane, contour.
tiles = [
    {'id': 1, 'name': 'nagib-0',  'kind': 'circle', 'r0': 15.0, 'r1': 15.0, 'web': 'staple'},
    {'id': 2, 'name': 'nagib-8',  'kind': 'circle', 'r0': 12.0, 'r1': 15.0, 'web': 'staple'},
    {'id': 3, 'name': 'nagib-15', 'kind': 'circle', 'r0': 9.0,  'r1': 15.0, 'web': 'staple'},
    {'id': 4, 'name': 'nagib-22', 'kind': 'circle', 'r0': 6.0,  'r1': 15.0, 'web': 'staple'},
    {'id': 5, 'name': 'staple',   'kind': 'circle', 'r0': 15.0, 'r1': 15.0, 'web': 'staple'},
    {'id': 6, 'name': 'perp',     'kind': 'circle', 'r0': 15.0, 'r1': 15.0, 'web': 'perp'},
    {'id': 7, 'name': 'diagonal', 'kind': 'circle', 'r0': 15.0, 'r1': 15.0, 'web': 'diagonal'},
    {'id': 8, 'name': 'sine',     'kind': 'circle', 'r0': 15.0, 'r1': 15.0, 'web': 'sine'},
    {'id': 9,  'name': 'core-0',   'kind': 'circle', 'r0': 14.0, 'r1': 14.0, 'web': 'staple', 'core': 0.0},
    {'id': 10, 'name': 'core-06',  'kind': 'circle', 'r0': 14.0, 'r1': 14.0, 'web': 'staple', 'core': 0.6},
    {'id': 11, 'name': 'peanut-cap','kind': 'peanut','r0': 12.5, 'r1': 12.5, 'web': 'staple', 'core': 1.2},
    {'id': 12, 'name': 'clover-cap','kind': 'clover','r0': 12.5, 'r1': 12.5, 'web': 'staple', 'core': 2.0},
    {'id': 13, 'name': 'ellipse',  'kind': 'ellipse','r0': 17.0, 'r1': 17.0, 'ry': 11.0, 'web': 'staple'},
    {'id': 14, 'name': 'square',   'kind': 'square', 'r0': 14.0, 'r1': 14.0, 'web': 'staple'},
    {'id': 15, 'name': 'peanut',   'kind': 'peanut', 'r0': 14.0, 'r1': 14.0, 'web': 'diagonal'},
    {'id': 16, 'name': 'clover',   'kind': 'clover', 'r0': 14.0, 'r1': 14.0, 'web': 'eight'},
]


def spiral(cx, cy, r_outer=19.6, r_inner=16.8, pitch=0.46):
    pts = []
    turns = (r_outer - r_inner) / pitch
    n = max(160, int(turns * 96))
    for i in range(n + 1):
        u = i / n
        t = 2.0 * math.pi * turns * u
        r = r_outer + (r_inner - r_outer) * u
        pts.append([round(cx + r * math.cos(t), 3), round(cy + r * math.sin(t), 3)])
    return pts


# Sixteen annular brims plus a complete grid of narrow ribs.  Intersections make one first-layer island.
foundation_paths = [spiral(cx, cy) for cx, cy in CENTERS]
for row in range(4):
    y = (1.5 - row) * PITCH
    foundation_paths.append([[-110.0, y - 0.22], [110.0, y - 0.22]])
    foundation_paths.append([[-110.0, y + 0.22], [110.0, y + 0.22]])
for col in range(4):
    x = (col - 1.5) * PITCH
    foundation_paths.append([[x - 0.22, -110.0], [x - 0.22, 110.0]])
    foundation_paths.append([[x + 0.22, -110.0], [x + 0.22, 110.0]])

# Short hash marks on the south side identify 1..16 even if a photo is separated from the plan.
for idx, (cx, cy) in enumerate(CENTERS, 1):
    marks = 1 + ((idx - 1) % 4)
    for m in range(marks):
        x = cx - 3.0 + m * 2.0
        foundation_paths.append([[x, cy - 19.6], [x, cy - 23.0]])

layers = []
caps_summary = []
for k in range(N):
    z = round(k * a.lh, 4)
    layer = {'k': k, 'zBot': z, 'zTop': round(z + a.lh, 4), 'contours': []}
    u = k / max(1, N - 1)
    for tile, (cx, cy) in zip(tiles, CENTERS):
        r = tile['r0'] + (tile['r1'] - tile['r0']) * u
        c = contour(cx, cy, tile['kind'], r, tile.get('ry'),
                    web=tile['web'], tile=tile['id'], label=tile['name'])
        layer['contours'].append(c)
    if k == CAP_LAYER:
        layer['caps'] = []
        for tile, (cx, cy) in zip(tiles[8:12], CENTERS[8:12]):
            pts = membrane(cx, cy, tile['kind'], tile['r0'], tile['core'])
            membrane_outer = tile['r0'] - a.w / 2.0
            rec = {'pts': pts, 'cx': cx, 'cy': cy, 'r_ins': membrane_outer,
                   'span_mm': round(2.0 * membrane_outer, 2), 'anchoredFrac': 1.0,
                   'coreRadius_mm': tile['core'], 'shape': tile['kind'], 'tile': tile['id']}
            layer['caps'].append(rec)
            caps_summary.append({'tile': tile['id'], 'z': z, 'shape': tile['kind'],
                                 'coreRadius_mm': tile['core'], 'declaredAnchor': 1.0})
    layers.append(layer)

summary = {
    'name': 'MERA_A2L_4x4_v1', 'N': N, 'H': round(H, 3), 'centers': CENTERS,
    'plateIntent_mm': [240, 240], 'tilePitch_mm': PITCH, 'tileCount': 16,
    'args': {'lh': a.lh, 'bead': a.bead, 'w': a.w, 'e': a.e, 'r0': 15.0,
             'K': 18, 'foundation': 3.0, 'maxbridge': 12.0,
             'temp': 220, 'bed': 55},
    'tiles': [{k: v for k, v in t.items() if k not in ('r0', 'r1', 'ry')} for t in tiles],
    'caps': caps_summary,
    'experiment': {
        'row1': 'radial lean: 0, 8, 15, 22 degrees approximately',
        'row2': 'same circle, four weave grammars',
        'row3': 'four rim-anchored membranes; core and boundary shape vary',
        'row4': 'ellipse, rounded square, peanut and clover contours',
        'readout': 'photograph whole plate from above and rows 1/2 in raking side light'
    }
}

out = Path(a.out)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'summary': summary,
                           'foundation': {'paths': foundation_paths, 'kind': 'connected-grid-brims'},
                           'layers': layers}, separators=(',', ':')), encoding='utf-8')

if a.svg:
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="-125 -125 250 250">',
           '<rect x="-125" y="-125" width="250" height="250" fill="#f4f1e8"/>',
           '<g fill="none" stroke="#163f37" stroke-width="0.7">']
    for tile, (cx, cy) in zip(tiles, CENTERS):
        q = contour(cx, cy, tile['kind'], tile['r1'], tile.get('ry'))['pts']
        svg.append('<path d="M ' + ' L '.join(f'{x},{-y}' for x, y in q) + '"/>')
    svg += ['</g>', '<g font-family="sans-serif" font-size="4" fill="#163f37" text-anchor="middle">']
    for tile, (cx, cy) in zip(tiles, CENTERS):
        svg.append(f'<text x="{cx}" y="{-cy + 1}">{tile["id"]:02d}</text>')
        svg.append(f'<text x="{cx}" y="{-cy + 6}" font-size="2.5">{tile["name"]}</text>')
    svg.append('</g></svg>')
    Path(a.svg).write_text('\n'.join(svg), encoding='utf-8')

print(json.dumps({'out': str(out), 'layers': N, 'height_mm': H, 'tiles': 16,
                  'caps': len(caps_summary), 'foundation_paths': len(foundation_paths),
                  'nominal_bbox_mm': [220.0, 220.0]}, indent=2))
