# P0 · Šuma 4×4 v2 — sixteen columns on merged brims, into one line · pending

Second version, rebuilt 2026-09-02 after the **P0 2×2 print** (`../2026-09-02_P0_suma_2x2_physical/`).
159 × 201 × 57 mm · 1771 paths/layers · 503 m of thread · 35 486 welds · 16 unintended overlaps in 236 layers ·
**support check 1.78 mm ≤ 3.5, 0 violations** · Route B ≈ 4.7 h kinematic.

## Three changes from v1, all driven by the 2×2 print
1. **Foundation = merged brims, holes between** (Semir's request: "brims around the columns that join,
   holes between them, more honest"). Each column gets a brim out to `r0 + w/2 + 6 mm`; where neighbours' brims
   touch they merge; the interstices stay open. 232 linked ring-paths, ordered by a nearest-endpoint tour so the
   first layer's hops stay short (≈554 mm of travel total). No filled slab anywhere.
2. **No bottom split tree.** The columns start as columns and rise from the brim web — 20 mm shorter and truer.
3. **Hole death now has a closure rule.** The 2×2 tangled because a hole shrank to r ≈ 5 mm and vanished with no
   cap. Now: a hole whose inscribed radius falls below `w/2 + e + ρ + 1.5 = 9.25 mm` is **capped** with a filled
   Archimedean spiral membrane in one layer (the dome-cap recipe: each turn lands beside the previous one, so the
   unsupported span at any instant is one pitch), and filled above. **21 caps, largest free span 11.2 mm < maxBridge 12.**

## The tree (from the contour-tree pre-phase)
16 columns → **8** at z 12.7 → **4** at z 24.7 → **2** at z 34.3 → **1** at z 38.4, with hole caps at
z 24.8 (×4), 26.0 (×4), 34.7 (×4), 35.6 (×2), 35.9 (×2), 37.8 (×2), 38.3 (×2), 47.2 (×1).
Elevation reads as an arcade: arches between the columns, then one vault.

## Known limits (honest)
- Eight layers show rung tips closer than 2×bead. They are all **at a neck about to merge** — that is the weld
  forming, not a knot; the check does not yet distinguish "weld" from "knot" and reports both.
- The 16 remaining unintended overlaps are single points in web layers, 0.07 ‰ of the thread.
- The wall gap seen on the 2×2 (~5 × 12 mm) has no established cause yet, so it is not fixed here.
- Route A STL not shipped (250 MB); regenerate if wanted.

## Files
- `P0_suma_4x4_v2_routeB.gcode` · SHA-256 `db179b7cc0b9737e4049e12d3b379bc359566d55d210b84d7729afef43bb9efe`
  · plate X 85.9–244.2 / Y 59.9–260.2 (A2L, not an A1) · 215 °C / 55 °C
- `P0_suma_4x4_v2_report.json`, `P0_suma_4x4_v2_geometry.json`, `P0_suma_4x4_v2_preview.png`
- regenerate: `python suma_geometry.py --cols 4 --rows 4 --out geo.json` then
  `node make_suma.mjs --geo geo.json --name P0_suma_4x4_v2 --nostl --head exports\a2l_start_block_template_2026-09-02.gcode --foot exports\a2l_end_block_harvested_2026-09-02.gcode`
  (drop `--nostl` for the Route A STL)

v1 in `../2026-09-02_P0_suma_4x4_pending/` is **superseded** — it has the filled slab, the split tree and the
uncapped hole death.
