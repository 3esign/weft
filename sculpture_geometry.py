#!/usr/bin/env python3
"""OBLAK (Bambu A2L) and GORA (Creality Ender-3 V4) - the two big sculptures. 2026-09-05.

One instrument language, two bodies, two machines. Each body is a hollow WEFT lattice whose SHAPE was
designed first (lobes, twist, corrugation, a wall whose depth follows the lobes) and whose PATH then
carries a fixed set of instruments, placed in a known order so that the height of a failure says
which limit was real (the Vrtlog principle):

  * lintels   - three windows with FLAT tops. The first closed ring above a window is a chord rail
                laid over air for the width of the window: 30 / 40 / 50 mm. LIMIT16 proved 16 mm.
                This is the "extreme chord" instrument, and it is over the evidence by 2-3x.
  * horns     - three hollow lattice lobes that grow OUT of the body at a fixed lateral rate
                (default 0.8 mm per layer, inside the gate's tab + bead/2 + allow reach) to
                30 / 40 / 50 mm of projection and come back. Same rate, three lengths: the
                variable is the cantilevered length, and only the height of a failure is read.
  * crown     - the ring is followed to a 32 mm hole and closed with a WOVEN IRIS: six layers of
                straight chords, each later layer resting on the crossings of the one below, every
                chord at most ~30 mm and every later free span under 16 mm. Not the single-layer
                inward spiral that failed physically on both machines (LIMIT16 cell 15); a new,
                versioned process identity: crown-woven-iris/v1, status experimental.
  * grammar   - staple at the foot (proven on D5, Suma, MERA, LIMIT16), then perp / sine / eight /
                diagonal in bands, then staple again through the windows, horns and crown.
  * twist     - the whole body rotates with height, so the weld columns are helices, not stacks
                (Semir's "playable weld disposition").
  * wall      - the wall depth breathes three times around every ring in phase with the three lobes
                (thick on the crest, thin in the valley) and changes with height.

Everything risky is high, everything proven is low. The body below a failed instrument is complete.

The declared experimental ceiling is --maxbridge 60 mm (the 50 mm lintel plus the end zones the gate measures). The build is gated twice:
once at 52 (must be clean) and once at the evidenced 16 mm, where every finding must fall inside a
declared instrument zone - the zones are written into summary.experiments for that attribution.

usage (through weft.py):  python weft.py build sculpture --variant oblak --machine a2l --out DIR --name OBLAK_A2L_X1
   direct:                python sculpture_geometry.py --variant oblak --bead 0.45 --lh 0.24 --plate 330 320 --out /tmp/oblak.json
"""
import argparse, json, math, sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('--variant', choices=('oblak', 'gora'), required=True)
ap.add_argument('--bead', type=float, required=True)
ap.add_argument('--lh', type=float, required=True)
ap.add_argument('--plate', type=float, nargs=2, required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--R', type=float, default=None, help='oblak: nominal sphere radius; gora: base half-side')
ap.add_argument('--H', type=float, default=None, help='gora: body height (oblak derives it from R)')
ap.add_argument('--turns', type=float, default=None, help='twist over the body height')
ap.add_argument('--lintels', default='30,40,50', help='window widths in mm (flat lintels)')
ap.add_argument('--fins', default='30,40,50', help='horn projections in mm')
ap.add_argument('--fin-rate', type=float, default=0.8, help='lateral growth of a horn, mm per layer')
ap.add_argument('--maxbridge', type=float, default=60.0, help='DECLARED experimental bridge ceiling (gate): the widest lintel plus the end zones the gate measures beyond it')
ap.add_argument('--safe-bridge', type=float, default=16.0, help='the physically evidenced ceiling (LIMIT16)')
ap.add_argument('--relief', type=float, default=1.0, help='relief amplitude scale')
ap.add_argument('--K', type=int, default=None, help='weld columns on the widest ring (dyadic ladder below it)')
ap.add_argument('--no-crown', action='store_true')
ap.add_argument('--no-fins', action='store_true')
ap.add_argument('--no-windows', action='store_true')
a = ap.parse_args()

BEAD, LH = a.bead, a.lh
IS_SPHERE = a.variant == 'oblak'
TAU = 2 * math.pi
ALLOW = 0.6                      # check_gcode --allow: a rail may sit bead/2+allow from material below
REACH = BEAD / 2 + ALLOW         # 0.825 for the A2L bead: continuous support without tabs
LINTELS = [float(v) for v in a.lintels.split(',') if v.strip()]
FINS = [float(v) for v in a.fins.split(',') if v.strip()]
FIN_RATE = a.fin_rate
SAFE = a.safe_bridge
GAP_MAX = 9.5                    # weld columns never further apart than this (a rail bridging between tabs spans at most this)

if a.maxbridge < max(LINTELS + [SAFE]):
    raise SystemExit(f'REFUSED: --maxbridge {a.maxbridge} is below the widest lintel {max(LINTELS)} mm; '
                     'declare the ceiling you are actually testing')
if FIN_RATE > REACH + 0.0:
    # a horn growing faster than bead/2+allow rests on tab tips only; that is a different (harder)
    # experiment and must be asked for explicitly with a tab that covers it
    print(f'note: fin rate {FIN_RATE} > continuous-support reach {REACH:.3f}; rails will bridge between tabs')


def clamp(v, lo, hi): return max(lo, min(hi, v))
def smooth(t): t = clamp(t, 0.0, 1.0); return t * t * (3 - 2 * t)
def rr(v, n=3): return round(float(v), n)
def lerp(a0, a1, t): return a0 + (a1 - a0) * t


# ----------------------------------------------------------------------------------------------
# the body
# ----------------------------------------------------------------------------------------------
if IS_SPHERE:
    R = a.R or 127.0                          # nominal radius; relief adds up to ~12 -> 139 max
    BASE_LEAN = math.radians(30.0)            # the sphere is cut where its wall leans 30 deg outward
    ZC = R * math.sin(BASE_LEAN)              # centre height above the plate
    R_CROWN = 16.0                            # the ring is followed down to this radius, then the iris
    Z_TOP = ZC + math.sqrt(R * R - R_CROWN * R_CROWN)
    N_BODY = int(math.floor(Z_TOP / LH))
    H_BODY = N_BODY * LH
    TURNS = a.turns if a.turns is not None else 0.35
    K_MAX = a.K or 96
    W_FOOT, W_BODY, W_TOP = 3.6, 2.8, 2.4
    SPEED, BRIDGE_SPEED = 30.0, 18.0
    TEMP, BED = 220, 55
    FOUNDATION = 8.0
    # instruments (material frame azimuths in degrees)
    WIN_AZ = [30.0, 150.0, 270.0]
    FIN_AZ = [90.0, 210.0, 330.0]
    Z_LINTEL_FRAC = 0.66
    FIN_Z0_FRAC = [0.66, 0.71, 0.77]         # every horn must be back on the body before the crown approach
else:
    S0 = a.R or 67.0                          # base half-side (134 mm square; its rotated diagonal + brim must clear 204 mm)
    S_TOP = 14.0                              # half-side at the crown (rounded -> ~16 mm radius hole)
    H_BODY_REQ = a.H or 190.0
    N_BODY = int(round(H_BODY_REQ / LH))
    H_BODY = N_BODY * LH
    CORNER = 12.0                             # corner radius of the rounded square at the base
    TURNS = a.turns if a.turns is not None else 0.20
    K_MAX = a.K or 96
    W_FOOT, W_BODY, W_TOP = 3.2, 2.6, 2.2
    SPEED, BRIDGE_SPEED = 26.0, 15.0
    TEMP, BED = 220, 60
    FOUNDATION = 6.0
    WIN_AZ = [0.0, 90.0, 180.0, 270.0]        # one per face; the fourth window is a 20 mm control
    FIN_AZ = [0.0, 90.0, 180.0, 270.0]
    Z_LINTEL_FRAC = 0.44
    FIN_Z0_FRAC = [0.55, 0.62, 0.69, 0.76]
    if len(LINTELS) == 3: LINTELS = [20.0] + LINTELS
    if len(FINS) == 3: FINS = [20.0] + FINS

if a.no_windows: LINTELS = []
if a.no_fins: FINS = []


def tw(z):
    """twist of the material frame at height z (radians)"""
    return TAU * TURNS * z / H_BODY


def ring_radius(z):
    """oblak: radius of the sphere's section; gora: half-side of the square section"""
    if IS_SPHERE:
        dz = z - ZC
        return math.sqrt(max(1e-6, R * R - dz * dz))
    return S0 - (S0 - S_TOP) * (z / H_BODY)


def relief_env(z, rs):
    """where the relief is allowed: small at the foot (outward lean), none near the crown"""
    if IS_SPHERE:
        foot = lerp(0.35, 1.0, smooth(z / 28.0))
        crown = smooth((rs - 30.0) / 40.0) ** 1.5
        return a.relief * foot * crown
    foot = lerp(0.4, 1.0, smooth(z / 25.0))
    crown = smooth((rs - 18.0) / 22.0)
    return a.relief * foot * crown


def relief(psi, z, rs):
    """radial relief in mm at material azimuth psi. Three lobes anchored to the material frame
       (so the wall-depth wave can follow them), a 5- and a 7-fold family that drift with height,
       and a fine corrugation that vanishes as the ring gets small."""
    env = relief_env(z, rs)
    if env <= 0: return 0.0
    t = tw(z)
    if IS_SPHERE:
        lobes = 6.0 * math.sin(3 * psi - math.pi / 2)
        five = 2.5 * math.sin(5 * psi + 1.9 - 1.4 * t) * (0.55 + 0.45 * math.sin(TAU * z / H_BODY * 1.3))
        seven = 2.0 * math.sin(7 * psi + 0.9) * math.sin(TAU * 1.7 * z / H_BODY + 0.3)
        corr = 1.5 * (rs / R) ** 3 * math.sin(24 * psi + 2.0 * t)
        return env * (lobes + five + seven + corr)
    # gora: the faces breathe (concave/convex), a 6-fold ripple and a fine corrugation
    faces = 4.0 * math.sin(4 * psi - math.pi / 2) * math.sin(TAU * z / H_BODY * 0.9 + 0.4)
    six = 2.0 * math.sin(6 * psi + 1.1 - 1.2 * t)
    corr = 1.2 * (rs / S0) ** 2 * math.sin(20 * psi + 1.6 * t)
    return env * (faces + six + corr)


def base_point(psi, z, rs):
    """the un-relieved section point (local frame, before twist) and its outward unit normal"""
    if IS_SPHERE:
        return rs * math.cos(psi), rs * math.sin(psi), math.cos(psi), math.sin(psi)
    # rounded square of half-side rs with corner radius scaled with the section
    c = CORNER * (0.35 + 0.65 * rs / S0)
    c = min(c, rs - 1.0)
    # walk the perimeter of a rounded square by angle: use the support-function parametrisation
    # p(psi) = (rs-c)*(sign cos, sign sin) + c*(cos psi, sin psi) with the square's corner picked by psi
    cx = (rs - c) * (1 if math.cos(psi) >= 0 else -1)
    cy = (rs - c) * (1 if math.sin(psi) >= 0 else -1)
    # direction of psi from the square centre; find intersection with the rounded square boundary
    dx, dy = math.cos(psi), math.sin(psi)
    # intersection with the flat sides first
    best = None
    for (nx, ny, off) in ((1, 0, rs), (-1, 0, rs), (0, 1, rs), (0, -1, rs)):
        den = nx * dx + ny * dy
        if den <= 1e-9: continue
        tt = off / den
        px, py = tt * dx, tt * dy
        # on the flat part? (the coordinate ALONG the side must be inside the corner-free range)
        along = abs(py) if nx else abs(px)
        if along <= rs - c + 1e-9:
            best = (px, py, nx, ny); break
    if best is None:
        # corner arc: circle of radius c at (cx, cy)
        # solve |t*d - C| = c
        b = -2 * (dx * cx + dy * cy); cc = cx * cx + cy * cy - c * c
        disc = max(0.0, b * b - 4 * cc)
        tt = (-b + math.sqrt(disc)) / 2
        px, py = tt * dx, tt * dy
        nx, ny = (px - cx) / c, (py - cy) / c
        best = (px, py, nx, ny)
    return best


def horn_bump(psi, z, rs, fins_here):
    """radial addition of the horns at this layer (material frame)"""
    add = 0.0
    for (psi_f, d, half) in fins_here:
        dpsi = (psi - psi_f + math.pi) % TAU - math.pi
        if abs(dpsi) < half:
            add += d * (0.5 + 0.5 * math.cos(math.pi * dpsi / half))
    return add


def section(z, k, fins_here, nphi):
    """world-frame closed polyline (CCW, start at material psi=0) and the material azimuth list"""
    rs = ring_radius(z)
    t = tw(z)
    pts, psis = [], []
    for i in range(nphi):
        psi = TAU * i / nphi
        bx, by, nx, ny = base_point(psi, z, rs)
        d = relief(psi, z, rs) + horn_bump(psi, z, rs, fins_here)
        px, py = bx + nx * d, by + ny * d
        c, s = math.cos(t), math.sin(t)
        pts.append((px * c - py * s, px * s + py * c))
        psis.append(psi)
    return pts, psis, rs


# ----------------------------------------------------------------------------------------------
# contour records
# ----------------------------------------------------------------------------------------------
def record(pts, closed, nodes_u, w, e, web, lam, amp, label, tile=None):
    """WEFT level-2 contour record. pts: list of (x,y). For closed contours the first point is
       appended at the end (the app's cum/total then includes the closing segment)."""
    q = list(pts)
    n = len(q)
    if closed:
        q_closed = q + [q[0]]
    else:
        q_closed = q
    normals = []
    for i in range(n):
        if closed:
            x0, y0 = q[(i - 1) % n]; x1, y1 = q[(i + 1) % n]
        else:
            x0, y0 = q[max(0, i - 1)]; x1, y1 = q[min(n - 1, i + 1)]
        tx, ty = x1 - x0, y1 - y0
        dd = math.hypot(tx, ty) or 1.0
        normals.append((ty / dd, -tx / dd))            # tangent rotated -90 deg: outward on a CCW loop
    if closed: normals = normals + [normals[0]]
    cum = [0.0]
    for p0, p1 in zip(q_closed, q_closed[1:]):
        cum.append(cum[-1] + math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
    total = cum[-1]
    nodes = sorted(set(rr(clamp(u, 0.0, total), 4) for u in nodes_u))
    gaps = [nodes[j + 1] - nodes[j] for j in range(len(nodes) - 1)]
    if closed and nodes: gaps.append(total - nodes[-1] + nodes[0])
    rec = {
        'pts': [[rr(x, 2), rr(y, 2)] for x, y in q_closed],
        'nrm': [[rr(x, 4), rr(y, 4)] for x, y in normals],
        'cum': [rr(v, 3) for v in cum],
        'total': rr(total, 3),
        'nodes': nodes, 'K': len(nodes),
        'maxNodeGap': rr(max(gaps) if gaps else total, 3),
        'closed': bool(closed),
        'w': rr(w, 3), 'e': rr(e, 3), 'web': web, 'label': label,
    }
    if lam: rec['breath'] = rr(lam, 3)          # period of the wall-depth wave (NOT the grammar's lambda)
    if amp: rec['amp'] = rr(amp, 3)
    if web == 'sine' and gaps:
        # the sine's crests must ride the rails every node gap on alternating rails: one wave per two gaps
        rec['lambda'] = rr(2 * sum(gaps) / len(gaps), 3)
    if tile is not None: rec['tile'] = tile
    return rec


def densify_nodes(nodes, total, closed, gap_max):
    """insert midpoints wherever two weld columns are further apart than gap_max (horn flanks)"""
    out = sorted(nodes)
    changed = True
    while changed:
        changed = False
        nxt = []
        for j, u in enumerate(out):
            nxt.append(u)
            if j + 1 < len(out):
                g = out[j + 1] - u
                if g > gap_max:
                    nxt.append(u + g / 2); changed = True
        if closed and len(out) > 1:
            g = total - out[-1] + out[0]
            if g > gap_max:
                nxt.append(out[-1] + g / 2 if out[-1] + g / 2 < total else (out[-1] + g / 2) - total)
                changed = True
        out = sorted(set(nxt))
    return out


def k_for(circ):
    """dyadic ladder of weld columns: never closer than 3 mm, as many as the ladder allows"""
    k = K_MAX
    while k > 12 and circ / k < 3.0:
        k //= 2
    return k


# ----------------------------------------------------------------------------------------------
# height programme: wall, tab, grammar bands
# ----------------------------------------------------------------------------------------------
def wall_nominal(z, rs):
    f = z / H_BODY
    if IS_SPHERE:
        w = W_FOOT if z < 14 else lerp(W_FOOT, W_BODY, smooth((z - 14) / 22))
        if f > 0.62: w = lerp(W_BODY, W_TOP, smooth((f - 0.62) / 0.22))
        if rs < 45: w = lerp(w, 1.8, smooth((45 - rs) / 25))
    else:
        w = W_FOOT if z < 12 else lerp(W_FOOT, W_BODY, smooth((z - 12) / 20))
        if f > 0.60: w = lerp(W_BODY, W_TOP, smooth((f - 0.60) / 0.25))
        if rs < 26: w = lerp(w, 1.8, smooth((26 - rs) / 10))
    return w


def tab_nominal(z, rs):
    f = z / H_BODY
    e = 0.7
    if f > 0.48: e = lerp(0.7, 0.9, smooth((f - 0.48) / 0.08))
    if IS_SPHERE and rs < 45: e = lerp(e, 1.4, smooth((45 - rs) / 25))
    if (not IS_SPHERE) and rs < 26: e = lerp(e, 1.3, smooth((26 - rs) / 10))
    return e


if IS_SPHERE:
    BANDS = [(0.00, 0.11, 'staple', 'foot'), (0.11, 0.20, 'perp', 'belly'), (0.20, 0.29, 'sine', 'wave'),
             (0.29, 0.36, 'eight', 'knot'), (0.36, 0.42, 'diagonal', 'truss'), (0.42, 1.01, 'staple', 'instruments')]
else:
    BANDS = [(0.00, 0.08, 'staple', 'foot'), (0.08, 0.14, 'perp', 'belly'), (0.14, 0.20, 'sine', 'wave'),
             (0.20, 0.46, 'staple', 'windows'), (0.46, 0.51, 'eight', 'knot'), (0.51, 0.55, 'diagonal', 'truss'),
             (0.55, 1.01, 'staple', 'instruments')]


def grammar_at(z):
    f = z / H_BODY
    for lo, hi, g, name in BANDS:
        if lo <= f < hi: return g, name
    return 'staple', 'instruments'


# ----------------------------------------------------------------------------------------------
# instruments: windows (flat lintels) and horns
# ----------------------------------------------------------------------------------------------
K_LINTEL = int(round(Z_LINTEL_FRAC * N_BODY))
if K_LINTEL % 2: K_LINTEL += 1       # the lintel ring must be a CHORD layer (even k): two rails bridging the window,
                                     # not a staple web zigzagging over it (first OBLAK gate: 81 mm of web in the air)
windows = []          # (psi_center, W, k_bottom, k_lintel)
for az, W in zip(WIN_AZ, LINTELS):
    h = 0.9 * W
    windows.append((math.radians(az), W, K_LINTEL - int(round(h / LH)), K_LINTEL))

horns = []            # (psi_center, P, k0, n_rise, n_hold, n_fall)
for az, P, zf in zip(FIN_AZ, FINS, FIN_Z0_FRAC):
    n_rise = int(math.ceil(P / FIN_RATE))
    horns.append((math.radians(az), P, int(round(zf * N_BODY)), n_rise, 4, n_rise))


def horns_at(k, rs):
    out = []
    for (psi_f, P, k0, n_rise, n_hold, n_fall) in horns:
        j = k - k0
        if j < 0 or j >= n_rise + n_hold + n_fall: continue
        if j < n_rise: d = min(P, FIN_RATE * (j + 1))
        elif j < n_rise + n_hold: d = P
        else: d = max(0.0, P - FIN_RATE * (j - n_rise - n_hold + 1))
        if d <= 0: continue
        half = (0.6 * P) / max(rs, 20.0)      # root half-width ~0.6 P along the surface
        half = min(half, math.radians(40))
        out.append((psi_f, d, half))
    return out


def amp_env(k):
    """the wall-depth wave fades out over 12 layers before any window or horn and returns after it,
       so no rail ever jumps by the amplitude in one layer"""
    f = 1.0
    zones = [(kb, kl) for (_, _, kb, kl) in windows] + \
            [(k0, k0 + nr + nh + nf) for (_, _, k0, nr, nh, nf) in horns]
    for (k0, k1) in zones:
        if k0 - 12 <= k < k0: f = min(f, smooth((k0 - k) / 12.0))
        elif k0 <= k < k1: f = 0.0
        elif k1 <= k < k1 + 12: f = min(f, smooth((k - k1) / 12.0))
    return f


def windows_at(k, rs):
    out = []
    for (psi_w, W, kb, kl) in windows:
        if kb <= k < kl:
            # half-angle of the window: an arc of W on the sphere, a flat chord of W on the pyramid's face
            half = (W / 2) / max(rs, 20.0) if IS_SPHERE else math.atan((W / 2) / max(rs, 20.0))
            out.append((psi_w, half, W))
    return out


# ----------------------------------------------------------------------------------------------
# build the layers
# ----------------------------------------------------------------------------------------------
layers = []
prev_pts = None
prev_had_fins = False
worst_body_move = 0.0
worst_move_layer = None
worst_crown_move = 0.0
worst_crown_layer = None
max_gap_body = 0.0
lintel_spans = {}
horn_tip_radius = []
motion_log = []
events = []
last_ring_pts = None
last_ring_rs = None

for k in range(N_BODY):
    z = k * LH
    zmid = (k + 0.5) * LH
    rs = ring_radius(zmid)
    circ_est = TAU * rs if IS_SPHERE else 8 * rs
    K = k_for(circ_est)
    web_now, _band_now = grammar_at(zmid)
    if web_now in ('sine', 'eight', 'diagonal') and circ_est / (2 * K) >= 2.3:
        K *= 2      # a rail is touched at every second node by these grammars; keep the rail run under GAP_MAX
    m = int(clamp(round(circ_est / (K * 1.05)), 4, 12))
    nphi = K * m
    fins_here = horns_at(k, rs)
    pts, psis, _ = section(zmid, k, fins_here, nphi)
    w = wall_nominal(zmid, rs)
    e = tab_nominal(zmid, rs)
    web, band = grammar_at(zmid)
    if web == 'perp':
        # the perp rung's tab is a spike traced out and back along one line (a doubled bead the overlap
        # detector reports ~115 times per layer); the perp band sits low, where nothing leans, so it
        # earns nothing here. Plain crossings.
        e = 0.0
    # the wall breathes with the three lobes: lambda = total/3 (oblak) or total/4 (gora), amp 25% of w
    lobes_n = 3 if IS_SPHERE else 4
    amp = 0.25 * w * relief_env(zmid, rs) * amp_env(k)
    wins = windows_at(k, rs)
    # node azimuth grid: material frame, ladder-registered
    node_idx = [j * m for j in range(K)]
    contours = []
    if not wins:
        rec_pts = pts
        # closed ring
        cum = [0.0]
        for p0, p1 in zip(rec_pts + [rec_pts[0]], (rec_pts + [rec_pts[0]])[1:]):
            cum.append(cum[-1] + math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
        total = cum[-1]
        nodes_u = [cum[i] for i in node_idx]
        nodes_u = densify_nodes(nodes_u, total, True, GAP_MAX)
        contours.append(record(rec_pts, True, nodes_u, w, e, web, total / lobes_n, amp, f'{a.variant}-ring'))
        max_gap_body = max(max_gap_body, contours[-1]['maxNodeGap'])
        last_ring_pts, last_ring_rs = pts, rs
    else:
        # cut the ring into arcs between windows (material frame)
        cuts = []
        for (psi_w, half, W) in wins:
            i0 = int(round(((psi_w - half) % TAU) / TAU * nphi)) % nphi
            i1 = int(round(((psi_w + half) % TAU) / TAU * nphi)) % nphi
            cuts.append((i0, i1, W))
        cuts.sort()
        # arcs: from cut[j].i1 to cut[j+1].i0 (wrapping)
        for j in range(len(cuts)):
            i_start = cuts[j][1]
            i_end = cuts[(j + 1) % len(cuts)][0]
            idx = []
            i = i_start
            while True:
                idx.append(i)
                if i == i_end: break
                i = (i + 1) % nphi
            arc = [pts[i] for i in idx]
            cum = [0.0]
            for p0, p1 in zip(arc, arc[1:]):
                cum.append(cum[-1] + math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
            total = cum[-1]
            # nodes = grid nodes inside the arc, at least 3.5 mm from an end, PLUS one weld column 2.5 mm from
            # each end: a web layer on an open arc ends on one rail, so without an end column the lintel's
            # other rail is unsupported for a whole node gap beyond the window (first gates: 59 mm measured
            # for a 50 mm window on GORA, 56.6 mm on OBLAK)
            nodes_u = [cum[n] for n, ii in enumerate(idx) if ii % m == 0 and 3.5 < cum[n] < total - 3.5]
            if total > 8.0:
                nodes_u = [2.5] + nodes_u + [total - 2.5]
            nodes_u = densify_nodes(nodes_u, total, False, GAP_MAX)
            contours.append(record(arc, False, nodes_u, w, e, web, None, 0.0, f'{a.variant}-arc-{j}'))
        # record the lintel spans the closed ring above will have to bridge
        if k == K_LINTEL - 1:
            for (i0, i1, W) in cuts:
                p0, p1 = pts[i0], pts[i1]
                lintel_spans[W] = rr(math.hypot(p1[0] - p0[0], p1[1] - p0[1]), 1)
    # motion telemetry (body only, outside horn layers)
    if prev_pts is not None and len(prev_pts) == len(pts) and not fins_here and not prev_had_fins:
        mv = max(math.hypot(p[0] - q[0], p[1] - q[1]) for p, q in zip(pts, prev_pts))
        crown_zone = IS_SPHERE and rs < 45
        if crown_zone:
            # the crown approach: the ring steps inward faster than the continuous reach and rests on the
            # tabs of the ring below (the D5 printed this regime to a 40 mm hole with 1.0 mm tabs)
            if mv > worst_crown_move: worst_crown_move, worst_crown_layer = mv, k
            if mv > REACH + e: motion_log.append((k, rr(mv, 3), rr(REACH + e, 3)))
        else:
            if mv > worst_body_move: worst_body_move, worst_move_layer = mv, k
    prev_pts = pts
    prev_had_fins = bool(fins_here)
    if fins_here:
        horn_tip_radius.append(max(math.hypot(p[0], p[1]) for p in pts))
    phase = band
    if wins: phase = 'windows'
    if fins_here: phase = 'horns'
    if IS_SPHERE and rs < 45: phase = 'crown-approach'
    layers.append({'k': k, 'zBot': rr(z, 4), 'zTop': rr(z + LH, 4), 'w': rr(w, 3), 'tab': rr(e, 3),
                   'web': web, 'phase': phase, 'contours': contours})
    # events
    if k > 0 and layers[-2]['phase'] != phase:
        events.append({'z': rr(z, 2), 'k': k, 'event': f'{layers[-2]["phase"]} -> {phase}'})

# ----------------------------------------------------------------------------------------------
# crown: the woven iris
# ----------------------------------------------------------------------------------------------
crown_layers = []
IRIS_PROCESS = 'crown-woven-iris/v1'
if not a.no_crown and last_ring_pts is not None:
    ring_r_mean = sum(math.hypot(p[0], p[1]) for p in last_ring_pts) / len(last_ring_pts)
    w_c, e_c = 1.8, 1.4
    def ring_r_at(angle):
        """radius of the last ring in a given world direction (nearest sample)"""
        best, br = 1e9, ring_r_mean
        for p in last_ring_pts:
            d = abs((math.atan2(p[1], p[0]) - angle + math.pi) % TAU - math.pi)
            if d < best: best, br = d, math.hypot(p[0], p[1])
        return br
    def chord(offset, angle):
        """straight chord at signed distance `offset` from the centre, direction `angle`; each end runs
           0.8 mm past the ring's OUTER rail in that end's own direction, so it lands on material"""
        ca, sa = math.cos(angle), math.sin(angle)
        ends = []
        for sgn in (-1, 1):
            # solve for s along the chord where the point reaches the ring radius in its direction
            s = 0.0
            for _ in range(12):
                x = s * ca - offset * sa; y = s * sa + offset * ca
                rr_here = ring_r_at(math.atan2(y, x)) + w_c / 2 + 0.8
                s = sgn * math.sqrt(max(0.0, rr_here * rr_here - offset * offset))
            ends.append(s)
        s0, s1 = ends
        n = max(4, int(math.ceil((s1 - s0) / 0.5)))
        out = []
        for i in range(n + 1):
            s = s0 + (s1 - s0) * i / n
            out.append([rr(s * ca - offset * sa, 3), rr(s * sa + offset * ca, 3)])
        return out
    d1 = 0.40 * ring_r_mean          # ~6.5 mm on a 16 mm ring
    d2 = 0.29 * ring_r_mean
    plan = [
        [(+d1, 0.0), (-d1, 0.0)],
        [(+d1, math.pi / 2), (-d1, math.pi / 2)],
        [(+d2, math.pi / 4), (-d2, math.pi / 4)],
        [(+d2, 3 * math.pi / 4), (-d2, 3 * math.pi / 4)],
        [(0.0, 0.0), (0.0, math.pi / 2)],
        [(0.0, math.pi / 4), (0.0, 3 * math.pi / 4)],
    ]
    # free spans: layer 1 chords are supported only at the rim -> span = 2*sqrt(r_in^2 - d1^2)
    inner_rail = ring_r_mean - w_c / 2
    span1 = 2 * math.sqrt(max(0.0, inner_rail ** 2 - d1 ** 2))
    for j, chords in enumerate(plan):
        k = N_BODY + j
        z = k * LH
        # the ring is re-laid on every iris layer so the chord ends always have a rim below them
        cum = [0.0]
        ring = last_ring_pts
        for p0, p1 in zip(ring + [ring[0]], (ring + [ring[0]])[1:]):
            cum.append(cum[-1] + math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
        total = cum[-1]
        Kc = k_for(total)
        mc = len(ring) // Kc
        nodes_u = [cum[i * mc] for i in range(Kc)]
        rec = record(ring, True, nodes_u, w_c, e_c, 'staple', None, 0.0, 'crown-ring')
        paths = []
        for ci, (off, ang) in enumerate(chords):
            paths.append({'pts': chord(off, ang), 'role': 'bridge', 'closed': False, 'speed': BRIDGE_SPEED,
                          'label': f'iris-{j + 1}-{ci}', 'tile': 'crown',
                          'intent': f'{IRIS_PROCESS}: layer {j + 1} of {len(plan)}'})
        crown_layers.append({'k': k, 'zBot': rr(z, 4), 'zTop': rr(z + LH, 4), 'w': w_c, 'tab': e_c,
                             'web': 'staple', 'phase': 'crown-iris', 'contours': [rec], 'paths': paths})
    events.append({'z': rr(N_BODY * LH, 2), 'k': N_BODY, 'event': f'crown-approach -> crown-iris ({IRIS_PROCESS})'})
    crown_info = {'process': IRIS_PROCESS, 'physicalStatus': 'experimental', 'hole_diameter_mm': rr(2 * ring_r_mean, 1),
                  'layers': len(plan), 'firstLayerFreeSpan_mm': rr(span1, 1),
                  'laterLayersMaxFreeSpan_mm': rr(2 * d1, 1),
                  'evidenceBasis': 'LIMIT16 2026-09-04: bridges to 16 mm continuous on both machines; the single-layer '
                                   'inward spiral (limit16-18mm-v1) FAILED on both and is not used here',
                  'expected': 'first-layer chords sag; later grids land on them; a woven disc with ~5-8 mm openings'}
else:
    crown_info = None

all_layers = layers + crown_layers
H_TOTAL = all_layers[-1]['zTop']

# ----------------------------------------------------------------------------------------------
# foundation: rings around the base section, joined by spokes -> ONE connected first layer
# ----------------------------------------------------------------------------------------------
base_pts, base_psis, base_rs = section(0.5 * LH, 0, [], layers[0]['contours'][0]['K'] * 8)
def offset_ring(d):
    n = len(base_pts)
    out = []
    for i in range(n):
        x0, y0 = base_pts[(i - 1) % n]; x1, y1 = base_pts[(i + 1) % n]
        tx, ty = x1 - x0, y1 - y0
        dd = math.hypot(tx, ty) or 1.0
        nx, ny = ty / dd, -tx / dd
        px, py = base_pts[i]
        out.append([rr(px + nx * d, 2), rr(py + ny * d, 2)])
    out.append(out[0])
    return out
foundation_paths = []
w0 = layers[0]['w']
ring_offsets = [-(w0 / 2 + 1.0), -(w0 / 2 + 2.0)] + [w0 / 2 + 1.0 + 1.0 * i for i in range(int(FOUNDATION))]
for d in ring_offsets:
    foundation_paths.append(offset_ring(d))
# spokes: every 7.5 deg, from the innermost ring to just beyond the outermost, crossing the wall
n_sp = 48
nb = len(base_pts)
for s in range(n_sp):
    i = int(round(s * nb / n_sp)) % nb
    x0, y0 = base_pts[(i - 1) % nb]; x1, y1 = base_pts[(i + 1) % nb]
    tx, ty = x1 - x0, y1 - y0
    dd = math.hypot(tx, ty) or 1.0
    nx, ny = ty / dd, -tx / dd
    px, py = base_pts[i]
    din, dout = ring_offsets[1] - 0.6, ring_offsets[-1] + 0.6
    foundation_paths.append([[rr(px + nx * din, 2), rr(py + ny * din, 2)], [rr(px + nx * dout, 2), rr(py + ny * dout, 2)]])

# ----------------------------------------------------------------------------------------------
# checks that refuse
# ----------------------------------------------------------------------------------------------
violations, warnings = [], []
xs, ys = [], []
for lay in all_layers:
    for c in lay['contours']:
        for p in c['pts']: xs.append(p[0]); ys.append(p[1])
    for p in lay.get('paths', []):
        for q in p['pts']: xs.append(q[0]); ys.append(q[1])
for pth in foundation_paths:
    for p in pth: xs.append(p[0]); ys.append(p[1])
size = [max(xs) - min(xs) + W_FOOT, max(ys) - min(ys) + W_FOOT, H_TOTAL]
if size[0] > a.plate[0] - 16 or size[1] > a.plate[1] - 16:
    violations.append(f'{size[0]:.1f} x {size[1]:.1f} mm misses the 8 mm plate margin on {a.plate}')
if IS_SPHERE and max(math.hypot(x, y) for x, y in zip(xs, ys)) > 141.0:
    violations.append('a point of the body lies beyond the 28 cm envelope')
# the body must move less than the continuous-support reach everywhere outside the horns
if worst_body_move > REACH:
    violations.append(f'body contour moves {worst_body_move:.2f} mm between layers {worst_move_layer-1}->{worst_move_layer}, '
                      f'over the continuous-support reach {REACH:.3f}')
for (kk, mv, lim) in motion_log:
    violations.append(f'crown approach: ring steps {mv} mm at layer {kk}, beyond tab + reach {lim}')
# horns: the growth rate is the declared experiment; state it
for (psi_f, P, k0, n_rise, n_hold, n_fall) in horns:
    if FIN_RATE > REACH + tab_nominal((k0 + 1) * LH, ring_radius((k0 + 1) * LH)):
        violations.append(f'horn {P} mm grows {FIN_RATE} mm/layer, beyond tab + reach - even the tabs cannot catch it')
# every horn must have returned to the body before the crown approach (the ring must be round for the iris)
for (psi_f, P, k0, n_rise, n_hold, n_fall) in horns:
    k_end = k0 + n_rise + n_hold + n_fall
    if k_end > N_BODY - 30:
        violations.append(f'horn {P} mm ends at layer {k_end}, inside the crown approach (body ends at {N_BODY})')
# every node gap inside the safe bridge
gmax = max(c['maxNodeGap'] for lay in all_layers for c in lay['contours'])
if gmax > SAFE:
    violations.append(f'a weld-column gap of {gmax:.1f} mm exceeds the evidenced bridge {SAFE} mm')
# concave curvature vs the wall: sample every 20th layer, every point: turning angle per arc
def min_concave_radius(pts, closed):
    n = len(pts); best = 1e9
    rng = range(n) if closed else range(1, n - 1)
    for i in rng:
        x0, y0 = pts[(i - 1) % n]; x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % n]
        ax, ay, bx, by = x1 - x0, y1 - y0, x2 - x1, y2 - y1
        la, lb = math.hypot(ax, ay), math.hypot(bx, by)
        if la < 1e-9 or lb < 1e-9: continue
        cross = ax * by - ay * bx
        dot = ax * bx + ay * by
        ang = math.atan2(cross, dot)
        if ang < -1e-6:                       # clockwise turn on a CCW loop = concave
            rad = (la + lb) / 2 / abs(ang)
            best = min(best, rad)
    return best
worst_concave = 1e9
for lay in all_layers[::10]:
    for c in lay['contours']:
        pp = [tuple(p) for p in (c['pts'][:-1] if c['closed'] else c['pts'])]
        rc = min_concave_radius(pp, c['closed'])
        need = c['w'] / 2 + c['e'] + BEAD
        if rc < need:
            violations.append(f'layer {lay["k"]} z={lay["zBot"]}: concave radius {rc:.2f} < w/2+e+bead {need:.2f}')
        worst_concave = min(worst_concave, rc)

summary = {
    'name': f'{a.variant.upper()} X1', 'variant': a.variant, 'N': len(all_layers), 'H': rr(H_TOTAL, 2),
    'args': {
        'lh': LH, 'bead': BEAD, 'firstLayerBead': rr(BEAD + 0.07, 3), 'firstLayerSpeed': 12,
        'w': rr(W_BODY, 2), 'r0': rr(ring_radius(0.5 * LH), 2), 'K': K_MAX, 'foundation': FOUNDATION,
        'maxbridge': a.maxbridge, 'maxcantilever': 4.8, 'allow': ALLOW, 'minanchor': 0.5, 'maxCapRadius': 36,
        'speed': SPEED, 'bridgeSpeed': BRIDGE_SPEED, 'temp': TEMP, 'bed': BED, 'fan': 100,
        'turns': TURNS,
    },
    'design': {
        'family': 'OBLAK / GORA - the two big sculptures (2026-09-05)',
        'shape': ('truncated sphere R%.0f, base lean 30 deg, 3 lobes + 5/7-fold drift + 24-fold corrugation, twist %.2f turns'
                  % (R, TURNS)) if IS_SPHERE else
                 ('twisted rounded-square pyramid, base %.0f mm, top %.0f mm, twist %.2f turns' % (2 * S0, 2 * S_TOP, TURNS)),
        'wallDepth': 'breathes with the lobes (amp 25%% of w), foot %.1f -> body %.1f -> top %.1f -> crown 1.8' % (W_FOOT, W_BODY, W_TOP),
        'grammarBands': [{'from': lo, 'to': hi, 'web': g, 'name': nm} for lo, hi, g, nm in BANDS],
        'openCrown': crown_info is None, 'caps': 0,
        'compiler': 'analytic surface -> WEFT level-2 layers (contours, open arcs, typed bridge paths)',
        'physicalBasis': 'specimens/LIMIT16_2026-09-04_RESULTS.md; D5 R140 dome; Suma; MERA; Vrtlog',
        'experimental': True,
    },
    'experiments': {
        'declaredBridgeCeiling_mm': a.maxbridge, 'evidencedBridge_mm': SAFE,
        'lintels': [{'W_mm': W, 'azimuth_deg': rr(math.degrees(psi_w), 1), 'zBottom': rr(kb * LH, 2), 'zLintel': rr(kl * LH, 2),
                     'measuredChord_mm': lintel_spans.get(W)} for (psi_w, W, kb, kl) in windows],
        'horns': [{'P_mm': P, 'azimuth_deg': rr(math.degrees(psi_f), 1), 'rate_mm_per_layer': FIN_RATE,
                   'zStart': rr(k0 * LH, 2), 'zEnd': rr((k0 + n_rise + n_hold + n_fall) * LH, 2)}
                  for (psi_f, P, k0, n_rise, n_hold, n_fall) in horns],
        'crown': crown_info,
        'twist': {'turns': TURNS, 'tangentialMove_mm_per_layer_at_widest': rr(TAU * (R if IS_SPHERE else S0) * TURNS / N_BODY, 3)},
        'protocol': 'gate at the declared ceiling must be clean; gate at the evidenced ceiling must attribute every '
                    'finding to one of the zones above (z ranges), otherwise the build is refused',
    },
    'supportCheck': {'reach_mm': rr(REACH, 3), 'worstBodyMove_mm': rr(worst_body_move, 3), 'atLayer': worst_move_layer,
                     'worstCrownApproachMove_mm': rr(worst_crown_move, 3), 'crownAtLayer': worst_crown_layer,
                     'crownReachWithTab_mm': rr(REACH + 1.4, 3), 'hornRate_mm_per_layer': FIN_RATE},
    'nodeDensity': {'maxNodeGap_mm': rr(gmax, 2), 'limit_mm': SAFE, 'ladder': [K_MAX, K_MAX // 2, K_MAX // 4, K_MAX // 8]},
    'geometry': {'minConcaveRadius_mm': rr(worst_concave, 2),
                 'maxHornTipRadius_mm': rr(max(horn_tip_radius), 1) if horn_tip_radius else None},
    'foundation': {'paths': len(foundation_paths), 'rings': len(ring_offsets), 'spokes': n_sp, 'islandsExpected': 1},
    'wallWidth': {'min': rr(min(l['w'] for l in all_layers), 2), 'max': rr(max(l['w'] for l in all_layers), 2)},
    'bbox_mm': [rr(min(xs), 2), rr(min(ys), 2), rr(max(xs), 2), rr(max(ys), 2)],
    'size_mm': [rr(v, 1) for v in size],
    'events': events,
    'violations': violations,
    'warnings': warnings + ['PRINTABILITY UNPROVEN', f'lintels {LINTELS} mm are {max(LINTELS)/SAFE:.1f}x over the evidenced bridge'
                            if LINTELS else 'no lintels'],
}

out_path = Path(a.out)
out_path.parent.mkdir(parents=True, exist_ok=True)
if violations:
    (out_path.with_suffix('.rejected')).write_text(json.dumps(summary, indent=1), encoding='utf-8')
    print(json.dumps(summary, indent=1))
    print('\nREFUSED:', file=sys.stderr)
    for v in violations: print('  * ' + v, file=sys.stderr)
    sys.exit(1)
out_path.write_text(json.dumps({'summary': summary, 'foundation': {'kind': 'rings+spokes', 'paths': foundation_paths},
                                'layers': all_layers}, separators=(',', ':')), encoding='utf-8')

# preview: plan cuts + elevation silhouette (SVG)
preview = out_path.with_name(out_path.stem.replace('_geometry', '') + '_preview.svg')
Wv, Hv = 620, 720
sc = 2.0
els = []
for lay in all_layers[::6]:
    z = lay['zBot']
    for c in lay['contours']:
        pts = ' '.join(f'{rr(160 + p[0] * 1.0, 1)},{rr(700 - z * 1.0 - p[1] * 0.35, 1)}' for p in c['pts'])
        col = {'staple': '#f6ff78', 'perp': '#79f79b', 'sine': '#45d9c0', 'eight': '#ff9f6b', 'diagonal': '#78a7ff'}.get(c['web'], '#fff')
        els.append(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width=".5" opacity=".75"/>')
    for p in lay.get('paths', []):
        pts = ' '.join(f'{rr(160 + q[0], 1)},{rr(700 - z - q[1] * 0.35, 1)}' for q in p['pts'])
        els.append(f'<polyline points="{pts}" fill="none" stroke="#ff4d6d" stroke-width=".8"/>')
for n, kk in enumerate((0, int(0.3 * N_BODY), int(0.55 * N_BODY), int(0.75 * N_BODY), N_BODY - 1)):
    lay = all_layers[kk]
    for c in lay['contours']:
        pts = ' '.join(f'{rr(470 + p[0] * 0.5, 1)},{rr(80 + n * 130 - p[1] * 0.5, 1)}' for p in c['pts'])
        els.append(f'<polyline points="{pts}" fill="none" stroke="#c9ff42" stroke-width=".7"/>')
    els.append(f'<text x="400" y="{80 + n * 130}" fill="#9bb0c8" font-family="sans-serif" font-size="9">z={lay["zBot"]}</text>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wv} {Hv}"><rect width="{Wv}" height="{Hv}" fill="#070a12"/>'
       + ''.join(els)
       + f'<text x="12" y="20" fill="#fff" font-family="sans-serif" font-size="12">{summary["name"]} - {size[0]:.0f} x {size[1]:.0f} x {size[2]:.0f} mm, {len(all_layers)} layers</text></svg>')
preview.write_text(svg, encoding='utf-8')
print(json.dumps(summary, indent=1))
print(f'PREVIEW {preview}')
