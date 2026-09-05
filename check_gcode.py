#!/usr/bin/env python3
"""WEFT gate - validate a FINAL G-code file: no extrusion may be laid where nothing supports it.

Written after WEFT-01 (2026-09-02), where five filled spiral membranes were emitted in mid-air and
shipped, because the pipeline's checks only ever looked at wall contours and never refused anything.
This checker deliberately ignores the generator and reads the artifact the machine will execute, so
no future path - wall, cap, foundation, or anything added later - can be exempt from it.

Method, per layer k (everything at or below --bedz is on the plate and is exempt):
  * rasterise layer k-1's extruded centrelines into a grid and take its distance transform;
  * every extruding point of layer k is SUPPORTED if it lies within bead/2 + allow of that material;
  * along each extruded polyline, group the unsupported points into runs and classify:
      - the whole polyline unsupported            -> FLOATING          (hard fail)
      - a run bounded by supported points at both ends, arc length <= maxbridge -> bridge (ok)
      - the same, longer than maxbridge           -> LONG_BRIDGE       (fail)
      - a run touching a free end of an open path -> CANTILEVER, fails over `allow` of arc length
  * a path emitted as a CAP is a filled spiral and is judged geometrically: at least --minanchor of
    its OUTERMOST TURN must land on the material below, and consecutive turns must be no more than a
    bead apart. This does not qualify the molten same-layer accretion process: the MERA A2L plate
    returned about one mostly formed membrane and three collapsed centres despite 1.000 rim anchoring.
    make_suma.mjs therefore requires a separate physical process status and explicit experimental opt-in.
    Judging a membrane by the diameter of the hole it closes would condemn a construction
    that works; judging it by whether any point of it grazes something lets a disc fly (Suma 4x4,
    2026-09-03: twelve membranes printed 6-29 mm above nothing and this checker called them warnings).
    A membrane with NO supported point is FLOATING; one whose rim misses is UNANCHORED_MEMBRANE.
  * the first layer is additionally checked for connectedness: --maxislands 1 demands that layer 0
    be a single connected piece (brims joined by ribs), which is what stops a plate of loose feet.

Problems are attributed to the emitting role by reading WEFT's own "; layer N <role>" comments, so a
failure names the generator that produced it. A .gcode.3mf is opened and the machine's G-code read out
of it, and --slicer-types reads a slicer's own ';TYPE:' comments instead - between them, an object that
went out as an STL through Bambu Studio (Route A: the Parasol, the D5 dome, the Suma 2x2) can be checked
too. Those objects were never outside these rules on purpose; nobody had pointed this at the container.

Exit code 1 on any failure, so a build script can simply refuse. Exit 2 if the file cannot be read.

usage: check_gcode.py FILE.gcode [--bead 0.42] [--allow 0.6] [--maxbridge 12] [--res 0.2]
                                 [--maxislands N] [--json out.json] [--quiet]
"""
import argparse, math, re, sys, json, os, zipfile, tempfile
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

ap = argparse.ArgumentParser()
ap.add_argument('gcode')
ap.add_argument('--bead', type=float, default=0.42)
ap.add_argument('--allow', type=float, default=0.6,
                help='how far a bead centreline may sit from the centreline of the material below and '
                     'still count as stacked (mm). Beyond bead/2+allow it is bridging.')
ap.add_argument('--maxbridge', type=float, default=12.0)
ap.add_argument('--res', type=float, default=0.2)
ap.add_argument('--zmerge', type=float, default=0.02, help='Z values within this are the same layer')
ap.add_argument('--bedz', type=float, default=0.5,
                help='everything at or below this Z is on the plate: exempt, and its material counts as support')
ap.add_argument('--maxislands', type=int, default=0,
                help='if >0, fail when the first layer has more than this many connected pieces')
ap.add_argument('--json', default=None)
ap.add_argument('--quiet', action='store_true')
ap.add_argument('--max-report', type=int, default=25)
ap.add_argument('--cap-roles', default='cap', help='comma-separated path roles judged by the spiral rule')
ap.add_argument('--slicer-types', action='store_true',
                help="also read a slicer's own ';TYPE:' feature comments as roles. G-code WEFT did not "
                     "write - a Bambu Studio export of a Route A STL - has no '; layer N role' comments, "
                     "so without this every path is attributed to '?' and the report says nothing about "
                     "which feature failed. Implies that the first ';TYPE:' also ends the start block.")
ap.add_argument('--max-cap-radius', type=float, default=36.0)
ap.add_argument('--minanchor', type=float, default=0.5,
                help="fraction of a membrane's OUTERMOST turn that must land on the material below. "
                     "The spiral law is about the outer turn, not about any point of the disc: a cap "
                     "whose middle happens to graze something while its rim hangs over air is not anchored.")
ap.add_argument('--dump', default=None,
                help='render the worst offending layers to this PNG: material below in grey, this '
                     'layer in blue, the points with nothing under them in red')
ap.add_argument('--dump-n', type=int, default=4)
ap.add_argument('--maxcantilever', type=float, default=3.0,
                help='a free end has one anchor instead of two, so it gets a quarter of the bridge budget')
a = ap.parse_args()

NUM = re.compile(r'([XYZEF])(-?\d*\.?\d+)')
LAB = re.compile(r'^;\s*layer\s+(\d+)\s+(\S+)')

# ---------------- parse into layers of extruded polylines ----------------
x = y = z = 0.0
layers = {}          # zkey -> {'z':, 'paths':[ {'pts':[(x,y)], 'line':, 'role':} ]}
cur = None
role = '?'
seen_layer = False      # everything before the first "; layer N" comment is the machine's start block
line_no = 0
# A .gcode.3mf is a zip with the machine's G-code inside it. Route A objects - the Parasol, the D5
# dome, the Suma 2x2 - never had their final G-code written by WEFT at all: the STL goes through Bambu
# Studio and STUDIO emits the moves. Those objects were therefore outside every check this file makes,
# not because anyone exempted them but because nobody pointed it at the container. Read it.
GCODE_IN_3MF = 'Metadata/plate_1.gcode'
_tmp = None
_src = a.gcode
if a.gcode.lower().endswith('.3mf'):
    try:
        _z = zipfile.ZipFile(a.gcode)
        _name = GCODE_IN_3MF if GCODE_IN_3MF in _z.namelist() else next(
            (n for n in _z.namelist() if n.lower().endswith('.gcode')), None)
        if _name is None:
            print(f'{a.gcode}: no G-code inside the container', file=sys.stderr); sys.exit(2)
        _tmp = tempfile.NamedTemporaryFile(suffix='.gcode', delete=False)
        _tmp.write(_z.read(_name)); _tmp.close()
        _src = _tmp.name
        if not a.quiet:
            print(f'reading {_name} out of {os.path.basename(a.gcode)}')
    except zipfile.BadZipFile as exc:
        print(f'cannot read {a.gcode}: {exc}', file=sys.stderr); sys.exit(2)
try:
    fh = open(_src, 'r', encoding='utf-8', errors='replace')
except OSError as exc:
    print(f'cannot read {a.gcode}: {exc}', file=sys.stderr); sys.exit(2)
for raw in fh:
    line_no += 1
    s = raw.strip()
    if not s:
        continue
    if s[0] == ';':
        m = LAB.match(s)
        if m:
            role = m.group(2); seen_layer = True
        elif a.slicer_types and s[1:].lstrip().upper().startswith('TYPE:'):
            role = s.split(':', 1)[1].strip() or '?'
            seen_layer = True
        continue
    if not (s.startswith('G0') or s.startswith('G1')):
        continue
    d = dict(NUM.findall(s.split(';')[0]))
    nx = float(d['X']) if 'X' in d else x
    ny = float(d['Y']) if 'Y' in d else y
    nz = float(d['Z']) if 'Z' in d else z
    e = float(d['E']) if 'E' in d else 0.0
    moved = (abs(nx - x) > 1e-9 or abs(ny - y) > 1e-9)
    if e > 0 and moved:
        key = round(nz / max(a.zmerge, 1e-6))
        if cur is None or cur['key'] != key or cur['end'] != (x, y):
            cur = {'key': key, 'z': nz, 'pts': [(x, y)], 'line': line_no,
                   'role': role if seen_layer else 'startblock'}
            layers.setdefault(key, {'z': nz, 'paths': []})['paths'].append(cur)
        cur['pts'].append((nx, ny)); cur['end'] = (nx, ny)
    else:
        cur = None
    x, y, z = nx, ny, nz

keys = sorted(layers)
if not keys:
    print('no extruding moves found', file=sys.stderr); sys.exit(2)

allpts = np.array([p for k in keys for pa in layers[k]['paths'] for p in pa['pts']])
x0, y0 = allpts[:, 0].min() - 3, allpts[:, 1].min() - 3
x1, y1 = allpts[:, 0].max() + 3, allpts[:, 1].max() + 3
W = int(math.ceil((x1 - x0) / a.res)) + 1
Hh = int(math.ceil((y1 - y0) / a.res)) + 1
if not a.quiet:
    print(f'{len(keys)} layers, {sum(len(layers[k]["paths"]) for k in keys)} extruded paths, '
          f'grid {W}x{Hh} @ {a.res} mm', file=sys.stderr)


def raster(paths):
    g = np.zeros((Hh, W), bool)
    for pa in paths:
        p = pa['pts']
        for i in range(len(p) - 1):
            (ax, ay), (bx, by) = p[i], p[i + 1]
            n = max(1, int(math.ceil(math.hypot(bx - ax, by - ay) / (a.res * 0.7))))
            for t in range(n + 1):
                px = ax + (bx - ax) * t / n; py = ay + (by - ay) * t / n
                c = int(round((px - x0) / a.res)); r = int(round((py - y0) / a.res))
                if 0 <= r < Hh and 0 <= c < W:
                    g[r, c] = True
    return g


def sample(dist, pts):
    out = np.empty(len(pts))
    for i, (px, py) in enumerate(pts):
        c = int(round((px - x0) / a.res)); r = int(round((py - y0) / a.res))
        out[i] = dist[r, c] if (0 <= r < Hh and 0 <= c < W) else 1e9
    return out


CAP_ROLES = set(r.strip() for r in a.cap_roles.split(',') if r.strip())


def spiral_metrics(pts):
    """(turn-to-turn spacing, outer radius) of a filled spiral. Neighbours closer than three beads
       ALONG the path are the same turn and are skipped; what is left is the next turn in."""
    p = np.asarray(pts, float)
    if len(p) < 8:
        return 0.0, 0.0
    # Densify first. This metric asks how far one turn is from the next, and it answers with the
    # distance between SAMPLED POINTS - so a path the emitter has thinned to 2 mm segments reports
    # turns further apart than they are. The 2x2 membrane measured 0.83 mm here while its rings were
    # laid 0.38 mm apart: the sparse sampling, not the geometry. Distance to the neighbouring turn is
    # a property of the curve, so sample the curve, not the emitter's opinion of it.
    d0 = np.hypot(*np.diff(p, axis=0).T)
    if d0.max() > 0.1:
        dense = [p[0]]
        for i in range(len(p) - 1):
            n = max(1, int(math.ceil(d0[i] / 0.1)))
            for j in range(1, n + 1):
                dense.append(p[i] + (p[i + 1] - p[i]) * (j / n))
        p = np.asarray(dense, float)
    c = p.mean(axis=0)
    rad = float(np.hypot(*(p - c).T).max())
    # the last millimetre of a spiral is a solid dot, not turns: measuring "turn spacing" there
    # picks a point one and a half turns away and reports a gap the geometry never had
    keep = np.hypot(*(p - c).T) > 1.2
    if keep.sum() >= 8:
        p = p[keep]
    seg = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
    tree = cKDTree(p)
    worst = 0.0
    skip = 3.0 * a.bead
    for i in range(len(p)):
        for k in (8, 24, 64, 256, len(p)):
            dd, jj = tree.query(p[i], k=min(k, len(p)))
            ok = [dd[t] for t in range(len(jj)) if abs(seg[jj[t]] - seg[i]) > skip]
            if ok:
                worst = max(worst, ok[0]); break
            if k >= len(p):
                break
    return worst, rad


def outermost_turn(P, rr):
    """Which points belong to the membrane's outer turn.

    The first version of this, written the same morning, took every point with radius within two beads
    of the maximum - which silently assumes the membrane is a CIRCLE. It is the identical mistake that
    put twelve membranes in the air on the Suma 4x4: a shape answered with a radius. On a membrane that
    follows a clover-shaped courtyard it selects the four corners and nothing else, and reported 0.50
    where the true figure was near one.

    A filled membrane starts or ends at its rim, so the outer turn is simply the first closed loop of
    the path, taken from whichever end has the larger mean radius. No assumption about its shape."""
    n = len(P)
    if n < 12:
        return np.ones(n, bool)
    close = 1.5 * a.bead

    def loop_from(start_at_head):
        idx = range(1, n) if start_at_head else range(n - 2, -1, -1)
        p0 = P[0] if start_at_head else P[-1]
        walked = 0.0
        prev = p0
        for i in idx:
            walked += float(np.hypot(*(P[i] - prev))); prev = P[i]
            if walked > 3.0 * close and float(np.hypot(*(P[i] - p0))) < close:
                return (slice(0, i + 1) if start_at_head else slice(i, n))
        return None

    a_, b_ = loop_from(True), loop_from(False)
    cands = [x for x in (a_, b_) if x is not None]
    if not cands:
        return rr >= max(0.0, float(rr.max()) - 2.0 * a.bead)     # not a closed membrane: fall back
    best = max(cands, key=lambda sl: float(rr[sl].mean()))
    mask = np.zeros(n, bool); mask[best] = True
    return mask


problems = []
membranes = []      # every cap path, pass or fail, with the anchoring this checker MEASURED.
                    # The Suma 4x4 shipped twelve flying discs while its generator believed 0.82;
                    # nothing catches a wrong belief except an independent number to compare it with,
                    # so the number is now always written, not only when something already failed.
stats = {'floating': 0, 'long_bridge': 0, 'cantilever': 0, 'bridges': 0, 'bad_membrane': 0,
         'unanchored_membrane': 0,
         'checked_paths': 0, 'checked_points': 0, 'exempt_layers': 0, 'first_layer_islands': 0}
by_role = {}
gaps = []
prev = None
first_raster = None
for ki, k in enumerate(keys):
    lay = layers[k]
    # A layer is exempt if it is on the plate, or if it belongs to the machine's own start block —
    # a Bambu prime line runs at z = 0.8, well above any sane bedz, and comparing the object's second
    # layer against a purge stripe on the far side of the bed reports 200 mm of "floating".
    startblock = all(p['role'] == 'startblock' for p in lay['paths'])
    if lay['z'] <= a.bedz or startblock or prev is None:
        r = raster(lay['paths'])
        if first_raster is None and not startblock:
            first_raster = r        # the object's own first layer, not the priming lines
        prev = r if prev is None else (prev | r)
        stats['exempt_layers'] += 1
        continue
    dist = ndimage.distance_transform_edt(~prev) * a.res
    for pa in lay['paths']:
        pts = pa['pts']; stats['checked_paths'] += 1; stats['checked_points'] += len(pts)
        d = sample(dist, pts)
        gaps.append((round(lay['z'], 2), pa['role'], float(np.percentile(d, 99)), float(d.max())))
        sup = d <= (a.bead / 2 + a.allow)
        if pa['role'] in CAP_ROLES:
            # A membrane is judged by the rule that makes a spiral self-supporting, not by the diameter
            # of the hole it closes. But that rule has TWO halves and only one of them was checked here
            # until 2026-09-03: turn spacing was measured, anchoring was not - `sup.any()` passes a disc
            # that grazes something anywhere. The Suma 4x4 print shipped twelve membranes whose outermost
            # turn stood 6-29 mm from anything and photographed as sagged, string-wrapped discs, and this
            # checker called them "bad membranes" while calling a 13 mm bridge a hard failure. The outer
            # turn is the whole anchor of a spiral: if it is in the air, so is the membrane.
            turn, rad = spiral_metrics(pts)
            P = np.asarray(pts, float)
            ctr = P.mean(axis=0)
            rr = np.hypot(*(P - ctr).T)
            outer = outermost_turn(P, rr)
            frac = float(sup[outer].mean()) if outer.any() else 0.0
            outer_gap = float(d[outer].min()) if outer.any() else float('inf')
            membranes.append({'z': round(lay['z'], 3), 'line': pa['line'],
                              'at': [round(float(ctr[0]), 2), round(float(ctr[1]), 2)],
                              'radius_mm': round(rad, 2), 'anchoredFrac': round(frac, 3),
                              'outerTurnGap_mm': (None if outer_gap == float('inf') else round(outer_gap, 2)),
                              'turnGap_mm': round(turn, 2), 'points': len(pts)})
            bad = []
            kind = 'BAD_MEMBRANE'
            if not sup.any():
                bad.append('no point of the membrane lands on the material below')
                kind = 'FLOATING'
            elif frac < a.minanchor:
                bad.append(f'only {100 * frac:.0f}% of the outermost turn lands on the material below, '
                           f'nearest {outer_gap:.1f} mm (needs {100 * a.minanchor:.0f}%)')
                kind = 'UNANCHORED_MEMBRANE'
            if rad > 3.0 * a.bead and turn > a.bead * 1.15:   # under three beads it is a dot, not turns
                bad.append(f'turns {turn:.2f} mm apart, over the {a.bead:.2f} mm bead')
            if rad > a.max_cap_radius:
                bad.append(f'membrane radius {rad:.1f} mm over the {a.max_cap_radius:.0f} mm bound')
            if bad:
                problems.append({'kind': kind, 'role': pa['role'], 'z': round(lay['z'], 3),
                                 'line': pa['line'], 'why': '; '.join(bad),
                                 'anchoredFrac': round(frac, 3),
                                 'outerTurnGap_mm': (None if outer_gap == float('inf') else round(outer_gap, 2)),
                                 'turnGap_mm': round(turn, 2), 'radius_mm': round(rad, 1),
                                 'at': [round(float(ctr[0]), 2), round(float(ctr[1]), 2)]})
                key = {'FLOATING': 'floating', 'UNANCHORED_MEMBRANE': 'unanchored_membrane'}.get(kind, 'bad_membrane')
                stats[key] += 1
                b = by_role.setdefault(pa['role'], {'floating': 0, 'long_bridge': 0, 'cantilever': 0,
                                                    'bad_membrane': 0, 'unanchored_membrane': 0, 'worst_mm': 0.0})
                b[key] = b.get(key, 0) + 1
            continue
        closed = math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < a.bead

        def note(kind, rec):
            problems.append(rec); stats[kind] += 1
            b = by_role.setdefault(pa['role'], {'floating': 0, 'long_bridge': 0, 'cantilever': 0, 'worst_mm': 0.0})
            b[kind] += 1; b['worst_mm'] = max(b['worst_mm'], rec.get('length_mm', 0.0))

        if not sup.any():
            span = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
            note('floating', {'kind': 'FLOATING', 'role': pa['role'], 'z': round(lay['z'], 3), 'line': pa['line'],
                              'points': len(pts), 'length_mm': round(span, 2),
                              'worst_gap_mm': round(float(d.min()), 2),
                              'at': [round(pts[0][0], 2), round(pts[0][1], 2)]})
            continue
        i = 0; n = len(pts)
        while i < n:
            if sup[i]:
                i += 1; continue
            j = i
            while j < n and not sup[j]:
                j += 1
            span = sum(math.hypot(pts[t + 1][0] - pts[t][0], pts[t + 1][1] - pts[t][1])
                       for t in range(i, min(j, n - 1)))
            free_end = (i == 0 or j >= n) and not closed
            worst = round(float(d[i:j].max()), 2)
            if free_end:
                if span > a.maxcantilever:
                    note('cantilever', {'kind': 'CANTILEVER', 'role': pa['role'], 'z': round(lay['z'], 3),
                                        'line': pa['line'], 'length_mm': round(span, 2), 'worst_gap_mm': worst,
                                        'at': [round(pts[i][0], 2), round(pts[i][1], 2)]})
            elif span > a.maxbridge:
                note('long_bridge', {'kind': 'LONG_BRIDGE', 'role': pa['role'], 'z': round(lay['z'], 3),
                                     'line': pa['line'], 'length_mm': round(span, 2), 'limit_mm': a.maxbridge,
                                     'worst_gap_mm': worst,
                                     'at': [round(pts[i][0], 2), round(pts[i][1], 2)]})
            else:
                stats['bridges'] += 1
            i = j
    prev = raster(lay['paths'])

# ---- first layer connectedness: one piece with holes, not a plate of loose feet ----
islands = 0
if first_raster is not None:
    grow = max(1, int(round((a.bead / 2) / a.res)))
    solid = ndimage.binary_dilation(first_raster, ndimage.generate_binary_structure(2, 2), iterations=grow)
    _, islands = ndimage.label(solid, structure=ndimage.generate_binary_structure(2, 2))
stats['first_layer_islands'] = int(islands)
island_fail = a.maxislands > 0 and islands > a.maxislands
if island_fail:
    problems.insert(0, {'kind': 'DISCONNECTED_FIRST_LAYER', 'role': 'adhesion', 'z': 0.0,
                        'islands': int(islands), 'limit': a.maxislands})

# ---- optional picture of the worst layers: nothing settles an argument like looking ----
if a.dump and problems:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    worst = sorted((p for p in problems if p.get('length_mm')), key=lambda p: -p['length_mm'])[:a.dump_n]
    if worst:
        fig, axs = plt.subplots(1, len(worst), figsize=(7 * len(worst), 7))
        if len(worst) == 1:
            axs = [axs]
        for ax, p in zip(axs, worst):
            zi = min(range(len(keys)), key=lambda i: abs(layers[keys[i]]['z'] - p['z']))
            below = raster(layers[keys[zi - 1]]['paths']) if zi else np.zeros((Hh, W), bool)
            dist = ndimage.distance_transform_edt(~below) * a.res
            ys, xs = np.nonzero(below)
            ax.scatter(x0 + xs * a.res, y0 + ys * a.res, s=6, c='#999999', marker='.', linewidths=0)
            for pa in layers[keys[zi]]['paths']:
                q = np.asarray(pa['pts'])
                ax.plot(q[:, 0], q[:, 1], lw=0.7, c='#1f5fbf')
                d = sample(dist, pa['pts'])
                bad = d > (a.bead / 2 + a.allow)
                ax.scatter(q[~bad, 0], q[~bad, 1], s=9, c='#1a9850', marker='o', linewidths=0)
                if bad.any():
                    ax.scatter(q[bad, 0], q[bad, 1], s=9, c='#d02020', marker='o', linewidths=0)
            cx, cy = p['at']
            ax.set_xlim(cx - 14, cx + 14); ax.set_ylim(cy - 14, cy + 14)
            ax.set_aspect('equal')
            ax.set_title(f"z={p['z']}  {p['role']}  {p['kind']}  {p['length_mm']} mm\n"
                         f"grey = material below, green = supported, red = over air", fontsize=9)
        plt.tight_layout()
        plt.savefig(a.dump, dpi=95)
        print('dumped', a.dump, file=sys.stderr)

fail = (stats['floating'] + stats['long_bridge'] + stats['cantilever'] + stats['bad_membrane']
        + stats['unanchored_membrane']
        + (1 if island_fail else 0))
gaps.sort(key=lambda t: -t[3])
res = {'file': a.gcode, 'layers': len(keys),
       'params': {'bead': a.bead, 'allow': a.allow, 'maxbridge': a.maxbridge, 'res': a.res,
                  'bedz': a.bedz, 'maxislands': a.maxislands, 'maxcantilever': a.maxcantilever},
       'stats': stats, 'byRole': by_role,
       'worstGaps': [[g[0], g[1], round(g[2], 2), round(g[3], 2)] for g in gaps[:15]],
       'membranes': membranes,
       'problems': problems[:400], 'problem_count': len(problems), 'PASS': fail == 0}
if a.json:
    json.dump(res, open(a.json, 'w'), indent=1)
if not a.quiet:
    print(json.dumps({k: res[k] for k in ('layers', 'stats', 'byRole', 'problem_count', 'PASS')}, indent=1))
    print('worst gaps (z, role, p99, max):', res['worstGaps'][:8])
    if membranes:
        w = min(membranes, key=lambda m: m['anchoredFrac'])
        print(f"membranes: {len(membranes)}, anchoring measured "
              f"min {w['anchoredFrac']:.2f} at z {w['z']} {w['at']}, "
              f"median {sorted(m['anchoredFrac'] for m in membranes)[len(membranes)//2]:.2f}")
    for p in problems[:a.max_report]:
        print('  ', p)
    if len(problems) > a.max_report:
        print(f'   ... and {len(problems)-a.max_report} more')
sys.exit(1 if fail else 0)
