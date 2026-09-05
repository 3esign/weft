#!/usr/bin/env python3
"""Render a WEFT level-2 geometry JSON (OBLAK/GORA) to a PNG: elevation, plan, and one instrument callout.
usage: python sculpture_preview.py GEOMETRY.json OUT.png [--size 1200]"""
import json, math, sys, argparse
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
ap = argparse.ArgumentParser(); ap.add_argument('geo'); ap.add_argument('out'); ap.add_argument('--size', type=int, default=1400)
a = ap.parse_args()
g = json.load(open(a.geo)); L = g['layers']; s = g['summary']
COL = {'staple': '#f2f0e8', 'perp': '#79f79b', 'sine': '#45d9c0', 'eight': '#ff9f6b', 'diagonal': '#78a7ff'}
fig = plt.figure(figsize=(a.size / 100, a.size / 100 * 0.62), dpi=100, facecolor='#0b0b0a')
ax1 = fig.add_axes([0.02, 0.05, 0.56, 0.9]); ax2 = fig.add_axes([0.60, 0.50, 0.38, 0.45]); ax3 = fig.add_axes([0.60, 0.05, 0.38, 0.40])
for ax in (ax1, ax2, ax3):
    ax.set_facecolor('#0b0b0a'); ax.set_aspect('equal'); ax.axis('off')
# elevation: oblique projection x' = x, y' = z + 0.32*y  (viewer slightly above, from -y)
segs = []; cols = []
for l in L[::3]:
    for c in l['contours']:
        pts = c['pts']
        xy = [(p[0], l['zBot'] + 0.30 * p[1]) for p in pts]
        segs.append(xy); cols.append(COL.get(c['web'], '#fff'))
    for p in l.get('paths', []):
        segs.append([(q[0], l['zBot'] + 0.30 * q[1]) for q in p['pts']]); cols.append('#ff4d6d')
ax1.add_collection(LineCollection(segs, colors=cols, linewidths=0.35, alpha=0.8))
ax1.autoscale()
ax1.set_title(f"{s['name']}  ·  {s['size_mm'][0]:.0f} × {s['size_mm'][1]:.0f} × {s['size_mm'][2]:.0f} mm  ·  {s['N']} layers", color='#f2f0e8', fontsize=11, loc='left')
# plan: every 25th layer
segs = []; cols = []
for i, l in enumerate(L[::25]):
    t = i / max(1, len(L) // 25)
    for c in l['contours']:
        segs.append([(p[0], p[1]) for p in c['pts']]); cols.append((0.9, 0.9 - 0.5 * t, 0.3 + 0.6 * t, 0.7))
for p in L[-1].get('paths', []):
    segs.append([(q[0], q[1]) for q in p['pts']]); cols.append('#ff4d6d')
ax2.add_collection(LineCollection(segs, colors=cols, linewidths=0.4)); ax2.autoscale()
ax2.set_title('plan · every 25th layer · iris chords in red', color='#aaa794', fontsize=9, loc='left')
# instruments text
ex = s['experiments']
txt = [f"lintels (chord over air): " + ', '.join(f"{l['W_mm']:.0f}" for l in ex['lintels']) + " mm at z " + ', '.join(f"{l['zLintel']:.0f}" for l in ex['lintels']),
       f"horns (out {ex['horns'][0]['rate_mm_per_layer'] if ex['horns'] else 0} mm/layer): " + ', '.join(f"{h['P_mm']:.0f}" for h in ex['horns']) + " mm",
       f"crown: {ex['crown']['process']} · hole {ex['crown']['hole_diameter_mm']} mm · first span {ex['crown']['firstLayerFreeSpan_mm']} mm" if ex.get('crown') else 'open crown',
       f"grammar bands: " + ' → '.join(b['web'] for b in s['design']['grammarBands']),
       f"twist {ex['twist']['turns']} turns · wall {s['wallWidth']['min']}–{s['wallWidth']['max']} mm · declared ceiling {ex['declaredBridgeCeiling_mm']:.0f} mm (evidence {ex['evidencedBridge_mm']:.0f})"]
ax3.text(0, 1, '\n'.join(txt), color='#f2f0e8', fontsize=8.5, va='top', family='monospace', transform=ax3.transAxes)
ax3.text(0, 0.02, 'PRINTABILITY UNPROVEN · experimental · WEFT 2026-09-05', color='#d0a050', fontsize=8, transform=ax3.transAxes)
fig.savefig(a.out, dpi=100, facecolor=fig.get_facecolor()); print('wrote', a.out)
