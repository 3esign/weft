# P2b · "Penjač · tri noge" · A2L — pending print

Built 2026-09-02 for the **Bambu A2L**, at the only bead and layer height WEFT has ever measured in
plastic: **0.45 / 0.24** (the D5 R140 dome and Šuma 2×2 both printed to completion at those numbers).
The Ender version of this piece was built on an assumed 0.42 — see `machines.json`.

| | |
|---|---|
| size | **91 × 82.6 × 240 mm** — 240 is the HEIGHT (corrected 2026-09-03 from the emitted G-code; the earlier line had the axes reordered and one value wrong) |
| layers | 1000 geometry layers, **1501** emitted paths |
| thread | 220.3 m continuous |
| welds | 20 851 |
| sliced | 9.86 m filament · 29.9 g · **~4 h 15 m** · plate 119.7…210.3 × 118.9…201.1 mm |
| gate | **PASS — 0 problems** over 303 277 checked points |

## Why 240 mm and not 168

The lateral motions of this body are absolute — an 18 mm sway, reaches of 26–28 mm — while the bands
they happen in are fractions of the height. A taller figure therefore moves *more slowly per layer*,
and the support rule gets easier, not harder. The 168 mm Ender version has 36 layers that degenerate
to a single thread; **this one has two**, both at the leg merges where the neck is genuinely a sliver.

## What to watch

1. **The first layer.** Three annular brims joined by three ribs 2.6 mm wide, seven openings between
   them, drawn as one continuous thread. If a rib lifts, the tripod becomes three islands.
2. **z ≈ 34 and z ≈ 66** — the two merges. One layer at each prints as a single centreline thread by
   design, because two rails will not fit through the neck at that instant.
3. **z ≈ 223** — the head takes over from the core. That seam used to be a 3 mm jump in radius and
   16 mm of chord over air; it is now continuous by construction. Look at it anyway.
4. **The grip bands.** perp holding, then the loop stitch (`eight`) while the arm pulls back in.

## Files

* `P2b_penjac_3_A2L.gcode.3mf` — **load this in Bambu Studio.** Route B, WEFT's own toolpath, with a
  start block harvested from Semir's own export.
* `P2b_penjac_3_A2L.gcode` — the same toolpath as plain G-code.
* `P2b_penjac_3_A2L.stl.zip` — the ribbon solid, for Route A or for looking at.
* `P2b_penjac_3_A2L_gate.json` · `_report.json` · `_geometry.json.gz` · `_preview.png` · `manifest.json`

## Rebuild

    python weft.py build climber --machine a2l --H 240 --legs 3 \
           --out specimens/<folder> --name P2b_penjac_3_A2L

Nothing else needs to be typed. `machines.json` owns the bead, the layer height, the plate and the
start/end blocks; see `USAGE.md`.
