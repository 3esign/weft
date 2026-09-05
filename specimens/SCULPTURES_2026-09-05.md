# OBLAK / GORA — the two big sculptures (2026-09-05)

One instrument language, two bodies, two machines. Built in a cloud session from `sculpture_geometry.py`
through the extended `make_suma.mjs` (open arcs, breathing wall, declared experimental bridge with a double
gate), transferred to the PC in SHA-256-verified chunks. Neither is printed yet.

| sculpture | machine | body | size (mm) | Z levels | thread | welds | file to print |
|---|---|---|---|---|---|---|---|
| **OBLAK** | Bambu Lab A2L (bead 0.45 validated) | sphere R127 cut at 30° outward lean, three lobes + 5/7/24-fold relief, twist 0.35, breathing wall 3.6→1.8 | 274 × 264.5 × 190.8 | 795 (+6 iris) | 990.5 m | 73,882 | `2026-09-05_OBLAK_A2L_X1_experimental/OBLAK_A2L_X1.gcode.3mf` |
| **GORA** | Creality Ender-3 V4 (bead 0.42 ASSUMED) | twisted rounded square 134 → 28 mm, breathing faces, twist 0.20, wall 3.2→1.8 | 151.5 × 153.7 × 191.2 | 956 | 583.2 m | 60,506 | `2026-09-05_GORA_ENDER3V4_X1_experimental/GORA_ENDER3V4_X1_routeB.gcode` |

The twelve instruments, in the same order on both (proof low, risk high — the height of a failure names the limit):
grammar bands staple → perp → sine → eight → diagonal → staple · breathing wall in phase with the lobes ·
helical weld columns (twist) · three (four) windows with FLAT lintels = chords over 30 / 40 / 50 mm of air
(GORA adds a 20 mm control) · three (four) hollow lattice horns growing 0.8 mm/layer to 30 / 40 / 50 mm ·
the crown closed by `crown-woven-iris/v1` (six chord layers of bridges over a ~32–36 mm hole; not the
inward spiral that failed on both machines in LIMIT16).

Gates: both PASS at the declared 60 mm (0 floating / 0 long bridge / 0 cantilever / first layer one island);
at the evidenced 16 mm both show exactly the declared instruments and nothing else (OBLAK 6 lintel + 4 iris
chords; GORA 8 lintel + 2 iris chords). Predictions are written in each folder; outcomes never rewrite them.

## Honest verdict
Verified: the gate results above are from the gate JSONs of the exact files whose SHA-256 is in each
`manifest.json` and was re-verified on the PC after reassembly. Not verified: anything physical. Known
weaknesses: the emitter reports 321 (OBLAK) / 115 (GORA) same-layer self-overlaps at the window-arc ends
(local double deposits at the jambs); the Ender bead is assumed; the perp band has no tabs by design; the
kinematic hours are lower bounds (D5: 26 h real for a comparable thread length).
