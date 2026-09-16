# P0 · Šuma 2×2 — four columns out of one foundation, back into one line · pending

**The first object where WEFT merges and splits contours by itself.** Built by `weft/suma_geometry.py`
(levels 1–2: contour tree, merged contours, registered weld nodes, support check) and `weft/make_suma.mjs`
(level 3: the app's own chord/web/ribbon/STL/G-code code). 73 × 87 × 60 mm, 603 paths/layers, 167 m of thread,
13 756 welds, 4 unintended overlaps in 595 layers (0.03 ‰), **support check v0: max step 2.4 mm ≤ 3.5, 0 violations.**

## What it is, bottom to top
| z (mm) | what happens | event |
|---|---|---|
| 0 | one **foundation slab** (linked offset rings, bead 0.52 @ 12 mm/s) covering all four footprints, with the courtyard already open | birth on foundation |
| 0.24–5 | one merged outline + a **courtyard ring** in the middle, radius shrinking 18.1 → 11.1 | — |
| 5.2 | rows separate | split 1→2 |
| 11–17 | two pills shrink to circles | — |
| 17.4 | pairs separate → **four columns** r = 8 mm (K = 16 welds per turn) | split 2→4 |
| 20–30 | plain columns | — |
| 30–33 | columns grow r 8 → 11.1 | — |
| 32.0 | pairs **merge** (necks filleted with ρ = 4.25 mm — the imagined circle at every corner) | merge 4→2 |
| 39–46 | pills grow to 18.1 | — |
| 44.3 | rows merge into one clover with a courtyard | merge 2→1 |
| 52–54 | growth to 20 closes the courtyard | hole death |
| 54–60 | one closed clover outline | — |

Weld nodes sit on each column's own 22.5° grid and are carried onto the merged curve, so weld columns continue
through every merge and split; through the neck fillets new node columns are born by arc length (p₀ = 3.14 mm).

## What it tests
- merging and splitting of walls as one continuous thread per layer, both directions, with the fillet rule;
- weld-column registration across topology events;
- a foundation slab that the columns "pull out of" (Semir, 00:55);
- the support rule as a number (centerline step per layer vs the rung+tab band);
- **Route B** (WEFT's own G-code, A2L start/end blocks harvested from the D5 gcode.3mf): never printed before — this is that test too.

## Honest limits
- The support check measures centerline steps only; bead overlap, tabs and thermal windows are not in it yet.
- The staple's inner tab on r = 8 columns is at its geometric limit (4 overlap points total) — beads will fuse slightly fatter there.
- The harvested end block lifts to Z 140.3 (D5's max_layer_z + 0.4) — harmless, the object is 60 mm.
- The start block probes the D5's bed-mesh area (301 × 301 mm) — longer than needed, harmless.

## Files
- `P0_suma_2x2.stl` · Route A · SHA-256 `e50e74ca8200d0a646c8d8fba87f400b3f32a9fb090184d42f8c69897d20cae7` (62 583 084 bytes)
- `P0_suma_2x2_routeB.gcode` · Route B · SHA-256 `8cc4450c81cf6722fc8ea703ab39fad1232018e6a530e589b12e6a1e09d7165c` · centred on the 330×320 plate (X 128.6–201.4, Y 116.6–203.4), 215 °C / 55 °C, fan 100 % above the first layer
- `P0_suma_2x2_report.json`, `P0_suma_2x2_geometry.json` (per-layer contours + nodes + events + support check), `P0_suma_2x2_preview.png`
- regenerate: `python suma_geometry.py --cols 2 --rows 2 --out geo.json` then
  `set WEFT_CHROMIUM=C:\Program Files\Google\Chrome\Application\chrome.exe && node make_suma.mjs --geo geo.json --name P0_suma_2x2 --head exports\a2l_start_block_template_2026-09-02.gcode --foot exports\a2l_end_block_harvested_2026-09-02.gcode`
  (needs numpy, scipy, scikit-image)
