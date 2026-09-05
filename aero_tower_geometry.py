#!/usr/bin/env python3
"""Experimental porous towers: C3D-style deformation compiled into WEFT layers.

RASEP: five skeletal ribbons, staggered radial cantilevers, strong clockwise twist.
VEO: four skeletal ribbons, paired lateral sails, counter-clockwise twist.

This deliberately pushes unsupported lateral motion. It is an experiment, not a
claim of printability. The failed LIMIT16 inward-spiral membrane is never used.
"""
import argparse
import json
import math
from pathlib import Path


ap = argparse.ArgumentParser()
ap.add_argument("--variant", choices=("rasep", "veo"), required=True)
ap.add_argument("--H", type=float, required=True)
ap.add_argument("--lh", type=float, required=True)
ap.add_argument("--bead", type=float, required=True)
ap.add_argument("--turns", type=float, default=None)
ap.add_argument("--w0", type=float, default=1.30)
ap.add_argument("--w1", type=float, default=1.65)
ap.add_argument("--K", type=int, default=8)
ap.add_argument("--foundation", type=float, default=7.0)
ap.add_argument("--maxbridge", type=float, default=16.0)
ap.add_argument("--plate", type=float, nargs=2, required=True)
ap.add_argument("--out", required=True)
a = ap.parse_args()

if a.H < 50 or a.lh <= 0 or a.bead <= 0:
    raise SystemExit("REFUSED: invalid tower height, layer height or bead")
if a.w0 < 2.15 * a.bead or a.w1 < a.w0:
    raise SystemExit("REFUSED: ribbon wall cannot carry two WEFT rails")
if a.K < 6 or a.K % 2:
    raise SystemExit("REFUSED: K must be an even integer >= 6")
if a.maxbridge > 16:
    raise SystemExit("REFUSED: LIMIT16 evidence does not justify more than 16 mm")

IS_RASEP = a.variant == "rasep"
RIBS = 5 if IS_RASEP else 4
TURNS = a.turns if a.turns is not None else (0.58 if IS_RASEP else -0.44)
N = max(180, int(round(a.H / a.lh)))
H = round(N * a.lh, 4)
COUNT = 48
TAB = 0.78 if IS_RASEP else 0.68
FIRST_BEAD = a.bead + 0.06


def rr(v, n=4):
    return round(float(v), n)


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def bell(t, center, width):
    x = (t - center) / width + 0.5
    if x <= 0.0 or x >= 1.0:
        return 0.0
    return math.sin(math.pi * x) ** 2


def wall_at(t):
    return a.w0 + (a.w1 - a.w0) * math.sin(math.pi * t) ** 2


def axis_at(t):
    if IS_RASEP:
        return (13.0 * smooth(t) + 4.5 * math.sin(2 * math.pi * t) * math.sin(math.pi * t) ** 2,
                7.0 * math.sin(math.pi * t) ** 2)
    return (-10.0 * math.sin(math.pi * t) ** 2,
            12.0 * smooth(t) - 4.0 * math.sin(2 * math.pi * t) * math.sin(math.pi * t))


def rib_center(t, j):
    ax, ay = axis_at(t)
    phase = 2 * math.pi * TURNS * smooth(t)
    theta = 2 * math.pi * j / RIBS + phase
    base_r = ((18.5 - 4.5 * t) if IS_RASEP else (17.0 - 3.5 * t))
    if IS_RASEP:
        centers = (0.27, 0.40, 0.53, 0.66, 0.79)
        reach = (25.0, 20.0, 27.0, 21.0, 24.0)[j]
        arm = reach * bell(t, centers[j], 0.205)
        crown = (8.0 if j in (0, 2, 4) else 3.0) * smooth((t - 0.76) / 0.24)
    else:
        centers = (0.34, 0.48, 0.62, 0.76)
        reach = (20.0, 25.0, 20.0, 24.0)[j]
        arm = reach * bell(t, centers[j], 0.19)
        crown = (7.0 if j in (1, 3) else 2.5) * smooth((t - 0.74) / 0.26)
    radius = base_r + arm + crown
    return ax + radius * math.cos(theta), ay + radius * math.sin(theta), theta


def loop_points(t, j):
    cx, cy, theta = rib_center(t, j)
    radial = 2.65 if IS_RASEP else 2.55
    tangent = 1.85 if IS_RASEP else 1.75
    swell = 1.0 + 0.12 * math.sin(math.pi * t) ** 2
    pts = []
    for i in range(COUNT):
        q = 2 * math.pi * i / COUNT
        dr = radial * swell * math.cos(q)
        dt = tangent * math.sin(q)
        pts.append([cx + dr * math.cos(theta) - dt * math.sin(theta),
                    cy + dr * math.sin(theta) + dt * math.cos(theta)])
    return pts


def contour_record(t, j, wall):
    q = loop_points(t, j)
    closed = q + [q[0]]
    normals = []
    for i in range(COUNT):
        x0, y0 = q[(i - 1) % COUNT]
        x1, y1 = q[(i + 1) % COUNT]
        tx, ty = x1 - x0, y1 - y0
        d = math.hypot(tx, ty) or 1.0
        normals.append([ty / d, -tx / d])
    cum = [0.0]
    for p0, p1 in zip(closed, closed[1:]):
        cum.append(cum[-1] + math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
    total = cum[-1]
    nk = a.K
    while total / nk > 0.42 * a.maxbridge:
        nk *= 2
    return {
        "pts": [[rr(x, 3), rr(y, 3)] for x, y in closed],
        "nrm": [[rr(x, 5), rr(y, 5)] for x, y in normals + [normals[0]]],
        "cum": [rr(v, 4) for v in cum],
        "total": rr(total, 4),
        "nodes": [rr((j2 + 0.5) * total / nk, 4) for j2 in range(nk)],
        "K": nk,
        "maxNodeGap": rr(total / nk, 4),
        "label": f"{a.variant}-rib-{j + 1}",
        "w": rr(wall, 3), "e": rr(TAB, 3), "web": "staple"
    }


layers = []
tracks = [[] for _ in range(RIBS)]
all_points = []
prev = None
worst_move = 0.0
max_node_gap = 0.0
for k in range(N):
    t = (k + 0.5) / N
    wall = wall_at(t)
    contours = [contour_record(t, j, wall) for j in range(RIBS)]
    current = []
    for j, contour in enumerate(contours):
        q = contour["pts"][:-1]
        current.append(q)
        all_points.extend(q)
        tracks[j].append(rib_center(t, j)[:2])
        max_node_gap = max(max_node_gap, contour["maxNodeGap"])
    if prev is not None:
        worst_move = max(worst_move, max(
            math.hypot(p[0] - r[0], p[1] - r[1])
            for rib, old in zip(current, prev) for p, r in zip(rib, old)))
    prev = current
    phase = "rise" if t < 0.22 else ("cantilever-field" if t < 0.82 else "forked-crown")
    layers.append({
        "k": k, "zBot": rr(k * a.lh), "zTop": rr((k + 1) * a.lh),
        "w": rr(wall, 3), "tab": rr(TAB, 3), "web": "staple",
        "phase": phase, "contours": contours
    })

# One center-connected radial star pierces every first rib and two annular rails.
t0 = 0.5 / N
base_centers = [rib_center(t0, j) for j in range(RIBS)]
outer = max(math.hypot(x, y) for x, y, _ in base_centers) + 5.5
foundation_paths = []
for rad in (max(6.0, outer - 9.0), outer):
    ring = [[rr(rad * math.cos(2 * math.pi * i / 144), 3),
             rr(rad * math.sin(2 * math.pi * i / 144), 3)] for i in range(145)]
    foundation_paths.append(ring)
    all_points.extend(ring)
for x, y, _ in base_centers:
    d = math.hypot(x, y) or 1.0
    spoke = [[0.0, 0.0], [rr((outer + 1.0) * x / d, 3), rr((outer + 1.0) * y / d, 3)]]
    foundation_paths.append(spoke)
    all_points.extend(spoke)

min_x = min(p[0] for p in all_points); max_x = max(p[0] for p in all_points)
min_y = min(p[1] for p in all_points); max_y = max(p[1] for p in all_points)
size = [max_x - min_x + a.w1, max_y - min_y + a.w1, H]
if size[0] > a.plate[0] - 16 or size[1] > a.plate[1] - 16:
    raise SystemExit(f"REFUSED: {size[0]:.1f}x{size[1]:.1f} mm misses plate margin")

allowance = TAB + a.bead / 2
risk = "extreme" if worst_move > allowance else "high"
summary = {
    "name": f"aero-tower-{a.variant}-x1",
    "variant": a.variant, "N": N, "H": H,
    "args": {
        "lh": a.lh, "bead": a.bead, "firstLayerBead": FIRST_BEAD,
        "firstLayerSpeed": 10, "w0": a.w0, "w1": a.w1, "K": a.K,
        "foundation": a.foundation, "maxbridge": a.maxbridge,
        "speed": 24 if IS_RASEP else 22, "bridgeSpeed": 13,
        "temp": 220, "bed": 55 if IS_RASEP else 60, "fan": 100
    },
    "design": {
        "family": "RASEP / VEO porous aero-towers", "ribs": RIBS,
        "turns": TURNS, "openCrown": True, "caps": 0,
        "voidStrategy": "separated continuous skeletal ribbons; no membrane",
        "grammar": "staple only",
        "compiler": "C3D parametric surface/deform intent -> WEFT manufacturing layers",
        "physicalBasis": "LIMIT16_2026-09-04_RESULTS.md",
        "experimental": True,
        "risk": risk,
        "expectedFailureModes": ["outward cantilever curl", "branch vibration", "stringing across voids", "rib detachment"]
    },
    "supportCheck": {
        "allowance_mm": rr(allowance), "worstContourMove_mm": rr(worst_move),
        "ratio": rr(worst_move / allowance, 3)
    },
    "nodeDensity": {"maxNodeGap_mm": rr(max_node_gap), "limit_mm": rr(0.42 * a.maxbridge)},
    "foundation": {"paths": len(foundation_paths), "rings": 2, "spokes": RIBS, "islandsExpected": 1},
    "wallWidth": {"min": a.w0, "max": a.w1},
    "bbox_mm": [rr(min_x, 2), rr(min_y, 2), rr(max_x, 2), rr(max_y, 2)],
    "size_mm": [rr(v, 1) for v in size],
    "violations": [],
    "warnings": ["PRINTABILITY UNPROVEN", "deliberately near the lateral-support limit"]
}

out_path = Path(a.out)
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps({
    "summary": summary,
    "foundation": {"kind": "annular-star", "paths": foundation_paths},
    "layers": layers
}, separators=(",", ":")), encoding="utf-8")

# Fast two-panel SVG: an isometric layer cage exposes real voids/cantilevers;
# five plan cuts show how the ribs orbit the bending axis.
preview = out_path.with_name(out_path.stem.replace("_geometry", "") + "_preview.svg")
colors = ("#f6ff78", "#c9ff42", "#79f79b", "#45d9c0", "#78a7ff")
iso = []
for k in range(0, N, 10):
    z = (k + 1) * a.lh
    for j, contour in enumerate(layers[k]["contours"]):
        pts = " ".join(
            f"{rr(x - .42 * y,2)},{rr(H - z + .20 * x + .10 * y,2)}"
            for x, y in contour["pts"]
        )
        iso.append(f'<polyline points="{pts}" fill="none" stroke="{colors[j % len(colors)]}" stroke-width=".38" opacity=".72"/>')
for j, track in enumerate(tracks):
    pts = " ".join(
        f"{rr(x - .42 * y,2)},{rr(H - i * H / max(1, N - 1) + .20 * x + .10 * y,2)}"
        for i, (x, y) in enumerate(track)
    )
    iso.append(f'<polyline points="{pts}" fill="none" stroke="{colors[j % len(colors)]}" stroke-width=".65" opacity=".9"/>')
cuts = []
for n, t in enumerate((0.05, 0.28, 0.50, 0.72, 0.94)):
    for j in range(RIBS):
        cx, cy, _ = rib_center(t, j)
        cuts.append(f'<circle cx="{110 + cx}" cy="{18 + n * 24 + cy * .32}" r="2" fill="none" stroke="{colors[j % len(colors)]}" stroke-width=".7"/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -8 220 {H + 20}">'
       '<rect x="-60" y="-8" width="220" height="180" fill="#070a12"/>'
       + "".join(iso) + "".join(cuts)
       + f'<text x="-56" y="0" fill="#fff" font-family="sans-serif" font-size="5">{a.variant.upper()} · EXPERIMENT X1</text>'
       + '<text x="92" y="0" fill="#9bb0c8" font-family="sans-serif" font-size="4">PLAN CUTS</text></svg>')
preview.write_text(svg, encoding="utf-8")

# A small typed intent handoff keeps the C3D relation explicit and editable later.
c3d = out_path.with_name(out_path.stem.replace("_geometry", "") + "_c3d_intent.json")
c3d.write_text(json.dumps({
    "schema": "c3d-design-intent/v1", "status": "intent-only; WEFT is the executed backend",
    "primitive": {"type": "profile-array", "count": RIBS, "profile": "ellipse"},
    "operations": [
        {"op": "loft", "along": "Z", "height": H},
        {"op": "twist", "turns": TURNS},
        {"op": "bend", "axis": "centerline"},
        {"op": "radial-cantilever-fields", "count": RIBS},
        {"op": "preserve-voids-between-ribs"}
    ],
    "manufacturingBackend": "WEFT alternating chord/web layers"
}, indent=2), encoding="utf-8")

print(json.dumps(summary, indent=2))
print(f"PREVIEW {preview}")
print(f"C3D_INTENT {c3d}")
