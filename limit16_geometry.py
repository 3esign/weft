#!/usr/bin/env python3
"""Generate a compact 4x4 limit plate for a registered WEFT machine.

The plate is deliberately diagnostic rather than decorative.  Its sixteen cells
share one connected first layer and one global Z schedule, while each cell asks a
different physical question: four bridges, four cantilevers, three line widths, a
long reversal path, two native WEFT leans, one membrane and one mixed-height body.

The Creality profile is still marked ASSUMED in machines.json.  Generating it
therefore requires --allow-assumed-bead; that acknowledgement is carried into the
geometry contract and every downstream report.
"""
import argparse
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PROFILES = json.loads((ROOT / "machines.json").read_text(encoding="utf-8"))

ap = argparse.ArgumentParser()
ap.add_argument("--machine", required=True, choices=("a2l", "ender"))
ap.add_argument("--out", required=True)
ap.add_argument("--svg")
ap.add_argument("--height", type=float, default=9.6)
ap.add_argument("--allow-assumed-bead", action="store_true")
a = ap.parse_args()

M = PROFILES[a.machine]
if M["beadSource"] != "measured" and not a.allow_assumed_bead:
    raise SystemExit(
        f"REFUSED: {a.machine} bead={M['bead']} mm is {M['beadSource']}; "
        "measure C1 or explicitly pass --allow-assumed-bead"
    )

LH = float(M["lh"])
BEAD = float(M["bead"])
FIRST_BEAD = float(M["firstLayerBead"])
N = max(8, int(round(a.height / LH)))
H = round(N * LH, 4)
PITCH = 46.0
CENTERS = [
    ((col - 1.5) * PITCH, (1.5 - row) * PITCH)
    for row in range(4)
    for col in range(4)
]
BRIDGES = (4.0, 8.0, 12.0, 16.0)
CANTILEVERS = (0.8, 1.8, 3.0, 4.5)
THIN = round(0.85 * float(M["nozzle"]), 3)
WIDE = round(1.65 * float(M["nozzle"]), 3)
BRIDGE_SPEED = 18.0 if a.machine == "a2l" else 15.0
PRINT_SPEED = 30.0 if a.machine == "a2l" else 26.0


def rr(v, n=3):
    return round(float(v), n)


def circle_points(cx, cy, radius, count=72, close=False):
    pts = [
        [rr(cx + radius * math.cos(2 * math.pi * i / count)),
         rr(cy + radius * math.sin(2 * math.pi * i / count))]
        for i in range(count)
    ]
    if close:
        pts.append(pts[0])
    return pts


def dense_line(p0, p1, step=0.4):
    length = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    count = max(1, int(math.ceil(length / step)))
    return [
        [rr(p0[0] + (p1[0] - p0[0]) * i / count),
         rr(p0[1] + (p1[1] - p0[1]) * i / count)]
        for i in range(count + 1)
    ]


def raw(tile, pts, role, label, *, closed=False, bead=None, speed=None, intent=None):
    row, col = divmod(tile - 1, 4)
    rec = {
        "pts": [[rr(x), rr(y)] for x, y in pts],
        "role": role,
        "label": label,
        "tile": tile,
        "row": row,
        "col": col,
        "closed": bool(closed),
    }
    if bead is not None:
        rec["bead"] = rr(bead)
    if speed is not None:
        rec["speed"] = rr(speed)
    if intent:
        rec["intent"] = intent
    return rec


def circle_contour(cx, cy, radius, tile, label, web, width=3.0, count=72):
    q = circle_points(cx, cy, radius, count=count, close=False)
    closed = q + [q[0]]
    normals = []
    for i in range(count):
        x0, y0 = q[(i - 1) % count]
        x1, y1 = q[(i + 1) % count]
        tx, ty = x1 - x0, y1 - y0
        ll = math.hypot(tx, ty) or 1.0
        normals.append([rr(ty / ll, 5), rr(-tx / ll, 5)])
    cum = [0.0]
    for p, r in zip(closed, closed[1:]):
        cum.append(cum[-1] + math.hypot(r[0] - p[0], r[1] - p[1]))
    total = cum[-1]
    nk = max(10, int(round(total / 4.5)))
    if nk % 2:
        nk += 1
    nodes = [(j + 0.5) * total / nk for j in range(nk)]
    row, col = divmod(tile - 1, 4)
    return {
        "pts": closed,
        "nrm": normals + [normals[0]],
        "cum": [rr(v, 4) for v in cum],
        "total": rr(total, 4),
        "nodes": [rr(v, 4) for v in nodes],
        "web": web,
        "w": width,
        "e": 0.7,
        "tile": tile,
        "label": label,
        "row": row,
        "col": col,
    }


def serpent(cx, cy):
    pts = []
    ys = [cy - 12 + 2 * i for i in range(13)]
    for i, y in enumerate(ys):
        left, right = cx - 13, cx + 13
        run = ([left, y], [right, y]) if i % 2 == 0 else ([right, y], [left, y])
        if not pts:
            pts.extend(run)
        else:
            pts.append(run[0])
            pts.append(run[1])
    return pts


def membrane(cx, cy, radius):
    pitch = BEAD * 0.78
    turns = radius / pitch
    count = max(240, int(math.ceil(turns * 72)))
    pts = []
    for i in range(count + 1):
        u = i / count
        t = 2 * math.pi * turns * u
        r = radius * (1 - u)
        pts.append([rr(cx + r * math.cos(t)), rr(cy + r * math.sin(t))])
    return pts


TILES = [
    {"id": 1, "code": "B04", "name": "bridge-4", "family": "bridge", "value_mm": 4.0,
     "question": "short bridge control", "readout": "underside straightness"},
    {"id": 2, "code": "B08", "name": "bridge-8", "family": "bridge", "value_mm": 8.0,
     "question": "medium bridge", "readout": "underside sag"},
    {"id": 3, "code": "B12", "name": "bridge-12", "family": "bridge", "value_mm": 12.0,
     "question": "current gate boundary", "readout": "sag and strand separation"},
    {"id": 4, "code": "B16", "name": "bridge-16", "family": "bridge", "value_mm": 16.0,
     "question": "deliberate bridge extension", "readout": "failure onset"},
    {"id": 5, "code": "C08", "name": "cantilever-0.8", "family": "cantilever", "value_mm": 0.8,
     "question": "short free end control", "readout": "tip curl"},
    {"id": 6, "code": "C18", "name": "cantilever-1.8", "family": "cantilever", "value_mm": 1.8,
     "question": "medium free end", "readout": "tip displacement"},
    {"id": 7, "code": "C30", "name": "cantilever-3.0", "family": "cantilever", "value_mm": 3.0,
     "question": "current gate boundary", "readout": "curl and nozzle contact"},
    {"id": 8, "code": "C45", "name": "cantilever-4.5", "family": "cantilever", "value_mm": 4.5,
     "question": "deliberate cantilever extension", "readout": "survival and curl"},
    {"id": 9, "code": "W34", "name": f"wall-{THIN:.2f}", "family": "line_width", "value_mm": THIN,
     "question": "thin single road", "readout": "continuity and measured width"},
    {"id": 10, "code": "WNM", "name": f"wall-{BEAD:.2f}", "family": "line_width", "value_mm": BEAD,
     "question": "machine bead control", "readout": "measured width"},
    {"id": 11, "code": "W66", "name": f"wall-{WIDE:.2f}", "family": "line_width", "value_mm": WIDE,
     "question": "wide road on 0.4 nozzle", "readout": "ridging and width"},
    {"id": 12, "code": "LONG", "name": "long-serpent", "family": "path", "value_mm": None,
     "question": "long uninterrupted path with 24 reversals", "readout": "flow drift and corner buildup"},
    {"id": 13, "code": "L17", "name": "weft-lean-17", "family": "lean", "value_deg": 17,
     "question": "native WEFT moderate radial lean", "readout": "side profile and welds"},
    {"id": 14, "code": "L32", "name": "weft-lean-32", "family": "lean", "value_deg": 32,
     "question": "native WEFT steep radial lean", "readout": "first degraded layer"},
    {"id": 15, "code": "MEM", "name": "membrane-18", "family": "membrane", "value_mm": 18.0,
     "question": "rim-anchored single-layer membrane", "readout": "turn fusion and center closure"},
    {"id": 16, "code": "MIX", "name": "mixed-height", "family": "scheduler", "value_mm": H,
     "question": "three bodies ending at 1/3, 2/3 and full height", "readout": "clean Z schedule and junctions"},
]


# Two annular roads around each cell plus crossing ribs make one first-layer island.
foundation_paths = []
for tile, (cx, cy) in enumerate(CENTERS, 1):
    foundation_paths.append(circle_points(cx, cy, 19.5, count=96, close=True))
    foundation_paths.append(circle_points(cx, cy, 18.85, count=96, close=True))
    row, col = divmod(tile - 1, 4)
    for mark in range(col + 1):
        x = cx - 3.0 + mark * 2.0
        foundation_paths.append([[rr(x), rr(cy - 19.5)], [rr(x), rr(cy - 22.0)]])
    for mark in range(row + 1):
        y = cy - 3.0 + mark * 2.0
        foundation_paths.append([[rr(cx - 19.5), rr(y)], [rr(cx - 22.0), rr(y)]])
edge = 1.5 * PITCH + 19.5
for row in range(4):
    y = (1.5 - row) * PITCH
    foundation_paths.append([[-edge, y], [edge, y]])
for col in range(4):
    x = (col - 1.5) * PITCH
    foundation_paths.append([[x, -edge], [x, edge]])


layers = []
cap_summary = []
mixed_stops = (max(2, round(N / 3)), max(4, round(2 * N / 3)), N)
for k in range(N):
    z_bot = rr(k * LH, 4)
    z_top = rr((k + 1) * LH, 4)
    layer = {"k": k, "zBot": z_bot, "zTop": z_top, "contours": [], "paths": []}

    # 01-04: two persistent support rails; three genuinely unsupported top strands.
    for tile, span in enumerate(BRIDGES, 1):
        cx, cy = CENTERS[tile - 1]
        x0, x1 = cx - span / 2, cx + span / 2
        layer["paths"].append(raw(tile, [[x0, cy - 5.5], [x0, cy + 5.5]],
                                  "support", TILES[tile - 1]["name"], intent="bridge support rail"))
        layer["paths"].append(raw(tile, [[x1, cy - 5.5], [x1, cy + 5.5]],
                                  "support", TILES[tile - 1]["name"], intent="bridge support rail"))
        if k == N - 1:
            for dy in (-3.0, 0.0, 3.0):
                layer["paths"].append(raw(tile, dense_line([x0, cy + dy], [x1, cy + dy]),
                                          "bridge", TILES[tile - 1]["name"],
                                          speed=BRIDGE_SPEED, intent=f"unsupported span {span:.1f} mm"))

    # 05-08: one persistent rail; three free-ended top roads.
    for j, length in enumerate(CANTILEVERS):
        tile = 5 + j
        cx, cy = CENTERS[tile - 1]
        x0 = cx - 5.5
        layer["paths"].append(raw(tile, [[x0, cy - 5.5], [x0, cy + 5.5]],
                                  "support", TILES[tile - 1]["name"], intent="cantilever root"))
        if k == N - 1:
            for dy in (-3.0, 0.0, 3.0):
                layer["paths"].append(raw(tile, dense_line([x0, cy + dy], [x0 + length, cy + dy]),
                                          "cantilever", TILES[tile - 1]["name"],
                                          speed=BRIDGE_SPEED, intent=f"free end {length:.1f} mm"))

    # 09-11: the same wall geometry with under-, nominal- and over-wide extrusion.
    for tile, width in zip((9, 10, 11), (THIN, BEAD, WIDE)):
        cx, cy = CENTERS[tile - 1]
        layer["paths"].append(raw(tile, circle_points(cx, cy, 8.5), "wall",
                                  TILES[tile - 1]["name"], closed=True, bead=width,
                                  speed=PRINT_SPEED, intent=f"commanded line width {width:.3f} mm"))

    # 12: around 360 mm without retraction, repeated at every Z level.
    cx, cy = CENTERS[11]
    layer["paths"].append(raw(12, serpent(cx, cy), "wall", TILES[11]["name"],
                              speed=PRINT_SPEED, intent="long path, 24 sharp reversals"))

    # 13-14: native WEFT contour grammar, not raw imitation.
    u = k / max(1, N - 1)
    cx, cy = CENTERS[12]
    layer["contours"].append(circle_contour(cx, cy, 8.0 + 3.0 * u, 13,
                                             TILES[12]["name"], "staple", width=3.0))
    cx, cy = CENTERS[13]
    layer["contours"].append(circle_contour(cx, cy, 5.0 + 6.0 * u, 14,
                                             TILES[13]["name"], "staple", width=3.0))

    # 15: a wall supports a rim-first membrane only on the final global layer.
    cx, cy = CENTERS[14]
    layer["paths"].append(raw(15, circle_points(cx, cy, 9.0), "support",
                              TILES[14]["name"], closed=True, intent="membrane rim"))
    if k == N - 1:
        cap = {
            "pts": membrane(cx, cy, 9.0),
            "cx": cx,
            "cy": cy,
            "r_ins": 9.0,
            "span_mm": 18.0,
            "anchoredFrac": 1.0,
            "tile": 15,
            "label": TILES[14]["name"],
            "bead": BEAD,
            "process": "single-layer-inward-spiral/limit16-18mm-v1",
            "physicalStatus": "failed",
            "evidence": "specimens/LIMIT16_2026-09-04_RESULTS.md",
        }
        layer["caps"] = [cap]
        cap_summary.append({"tile": 15, "z": z_bot, "span_mm": 18.0, "declaredAnchor": 1.0,
                            "process": "single-layer-inward-spiral/limit16-18mm-v1",
                            "physicalStatus": "failed",
                            "evidence": "specimens/LIMIT16_2026-09-04_RESULTS.md"})

    # 16: three independent bodies stop at different heights; small links mark each stop.
    cx, cy = CENTERS[15]
    xs = (cx - 6.0, cx, cx + 6.0)
    for branch, (x, stop) in enumerate(zip(xs, mixed_stops)):
        if k < stop:
            layer["paths"].append(raw(16, [[x, cy - 5.5], [x, cy + 5.5]],
                                      "support", TILES[15]["name"],
                                      intent=f"branch {branch + 1}, stop layer {stop}"))
        if k == stop - 1 and branch < 2:
            layer["paths"].append(raw(16, dense_line([x, cy], [xs[branch + 1], cy]),
                                      "bridge", TILES[15]["name"], speed=BRIDGE_SPEED,
                                      intent="six millimetre terminal link"))
    if k == N - 1:
        layer["paths"].append(raw(16, dense_line([cx + 3.0, cy], [cx + 9.0, cy]),
                                  "cantilever", TILES[15]["name"], speed=BRIDGE_SPEED,
                                  intent="center-anchored top junction"))
    layers.append(layer)


summary = {
    "name": f"LIMIT16_{a.machine.upper()}_v1",
    "machine": a.machine,
    "machineLabel": M["label"],
    "machineQualification": {
        "beadSource": M["beadSource"],
        "beadEvidence": M["beadEvidence"],
        "assumedAcknowledged": bool(a.allow_assumed_bead),
    },
    "N": N,
    "H": H,
    "tileCount": 16,
    "tilePitch_mm": PITCH,
    "centers": CENTERS,
    "plateIntent_mm": [182.0, 182.0],
    "args": {
        "lh": LH,
        "bead": BEAD,
        "firstLayerBead": FIRST_BEAD,
        "firstLayerSpeed": 12,
        "w": 3.0,
        "e": 0.7,
        "r0": 9.0,
        "K": 14,
        "foundation": 1.3,
        "maxbridge": 16.2,
        "maxcantilever": 4.8,
        "allow": 0.6,
        "minanchor": 0.5,
        "maxCapRadius": 20,
        "speed": PRINT_SPEED,
        "bridgeSpeed": BRIDGE_SPEED,
        "temp": M["temp"],
        "bed": M["bed"],
        "fan": 100,
    },
    "gatePolicy": {
        "meaning": "experimental admission ceiling, not a claim that every coupon will succeed",
        "bridge_mm": 16.2,
        "cantilever_mm": 4.8,
        "membrane_min_anchor": 0.5,
        "first_layer_max_islands": 1,
    },
    "tiles": TILES,
    "caps": cap_summary,
    "experiment": {
        "matrix": [
            "bridges: 4 / 8 / 12 / 16 mm",
            "cantilevers: 0.8 / 1.8 / 3.0 / 4.5 mm",
            f"roads: {THIN:.2f} / {BEAD:.2f} / {WIDE:.2f} mm plus long serpent",
            "native WEFT lean 17 / 32 deg, membrane, mixed-height scheduler",
        ],
        "photo": "photograph whole plate from above, then rows 1, 2 and 4 in low side light",
        "measure": "record pass/fail plus bridge sag, cantilever curl and actual road widths",
    },
}

payload = {
    "summary": summary,
    "foundation": {"paths": foundation_paths, "kind": "connected-rings-and-grid"},
    "layers": layers,
}
out = Path(a.out)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

if a.svg:
    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="-98 -98 196 196">',
        '<rect x="-98" y="-98" width="196" height="196" fill="#f3f0e7"/>',
        '<g fill="#fbfaf6" stroke="#173f38" stroke-width="0.55">',
    ]
    for cx, cy in CENTERS:
        svg.append(f'<rect x="{cx-20.5}" y="{-cy-20.5}" width="41" height="41" rx="3"/>')
    svg.append('</g><g stroke="#24a37a" stroke-width="1.0" fill="none">')
    for tile in TILES:
        cx, cy = CENTERS[tile["id"] - 1]
        sy = -cy
        fam = tile["family"]
        if fam == "bridge":
            span = tile["value_mm"]
            svg.append(f'<path d="M {cx-span/2} {sy-6} V {sy+6} M {cx+span/2} {sy-6} V {sy+6} M {cx-span/2} {sy} H {cx+span/2}"/>')
        elif fam == "cantilever":
            length = tile["value_mm"] * 2.2
            svg.append(f'<path d="M {cx-5.5} {sy-6} V {sy+6} M {cx-5.5} {sy} h {length}"/>')
        elif fam == "line_width":
            sw = max(0.5, tile["value_mm"] * 3)
            svg.append(f'<circle cx="{cx}" cy="{sy}" r="8.5" stroke-width="{sw}"/>')
        elif fam == "path":
            svg.append(f'<path d="M {cx-13} {sy-10} H {cx+13} V {sy-6} H {cx-13} V {sy-2} H {cx+13} V {sy+2} H {cx-13} V {sy+6} H {cx+13}"/>')
        elif fam == "lean":
            svg.append(f'<circle cx="{cx}" cy="{sy}" r="6"/><circle cx="{cx}" cy="{sy}" r="11"/>')
        elif fam == "membrane":
            svg.append(f'<circle cx="{cx}" cy="{sy}" r="9"/><circle cx="{cx}" cy="{sy}" r="5"/><circle cx="{cx}" cy="{sy}" r="1"/>')
        else:
            svg.append(f'<path d="M {cx-6} {sy-7} V {sy+7} M {cx} {sy-5} V {sy+7} M {cx+6} {sy-2} V {sy+7} M {cx-6} {sy} H {cx+6}"/>')
    svg.append('</g><g font-family="Segoe UI,sans-serif" fill="#173f38" text-anchor="middle">')
    for tile in TILES:
        cx, cy = CENTERS[tile["id"] - 1]
        sy = -cy
        svg.append(f'<text x="{cx}" y="{sy-14}" font-size="3.2" font-weight="700">{tile["id"]:02d} {tile["code"]}</text>')
        svg.append(f'<text x="{cx}" y="{sy+16}" font-size="2.5">{tile["name"]}</text>')
    svg.append(f'</g><text x="0" y="96" font-family="Segoe UI,sans-serif" font-size="3" text-anchor="middle" fill="#173f38">LIMIT16 · {M["label"]} · {H:.1f} mm</text></svg>')
    svg_out = Path(a.svg)
    svg_out.parent.mkdir(parents=True, exist_ok=True)
    svg_out.write_text("\n".join(svg), encoding="utf-8")

print(json.dumps({
    "out": str(out),
    "machine": a.machine,
    "bead_mm": BEAD,
    "bead_source": M["beadSource"],
    "layers": N,
    "height_mm": H,
    "logical_cells": 16,
    "foundation_paths": len(foundation_paths),
    "nominal_bbox_mm": [182.0, 182.0],
}, indent=2))
