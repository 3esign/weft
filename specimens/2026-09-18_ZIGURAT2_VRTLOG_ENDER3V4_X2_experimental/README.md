# ZIGURAT2 VRTLOG · Ender-3 V4 · X2 — the corner-cut stepped pyramid (2026-09-18)

**Status: NOT PRINTED. Experimental. Built on an ASSUMED bead (0.42 mm; C1 never printed).**
Pair of [ZIGURAT2 TKANJE](../2026-09-18_ZIGURAT2_TKANJE_A2L_X2_experimental/), which carries the full description
of the method. Supersedes the [X1 pair](../2026-09-17_ZIGURAT_VRTLOG_ENDER3V4_X1_experimental/).
**Only the lowest tier touches the plate.**

| | |
|---|---|
| file to print | `ZIGURAT2_VRTLOG_ENDER3V4_X2.gcode` (plain G-code, the Ender's harvested blocks) |
| size | 126.2 × 126.2 × 68.2 mm on the 220 × 220 plate |
| layers | 341 Z levels at 0.20 mm; 409 emitted paths |
| thread | 171.5 m · 13,104 weld nodes · 5.7 m filament · 17.2 g · 2 h 56 m in the header (expect 2–3×) |
| grammars | sine 155, staple 15 |
| gate at the declared 36 mm | PASS — 0 problems, 154,369 points, first layer 1 island |
| gate at the evidenced 16.2 mm | **8 findings — 7 on the horn flanks, 1 the crown's first chord; none in any corner cut** |
| self-overlaps | 12 |

## The body
Four tiers, sides **109.6 → 77.5 → 54.8 → 38.8 mm**, each rotated 45° from the one below by the cut itself.

| cut | from → to (mm) | layers | rise | slope | weld columns | pleats |
|---|---|---|---|---|---|---|
| 1 | 109.6 → 77.5 | 77 | 15.4 mm | 21.7° | K 96 at 4.5 mm | 8 × 1.4 mm |
| 2 | 77.5 → 54.8 | 55 | 11.0 mm | 21.9° | K 96 at 3.1 mm | 8 × 1.4 mm |
| 3 | 54.8 → 38.8 | 39 | 7.8 mm | 21.9° | K 48 at 4.4 mm | 8 × 1.4 mm |

Sine grammar on every tier; a 1.4 mm wave climbing the walls helically (four waves round, 24 mm rise), suppressed
on the ramps; the wall breathes; four **8 mm horns** on the last tier's corners at 0.8 mm/layer, their flanks
widened so the concave radius at a horn's base clears w/2 + e + bead (the first attempt at 0.38 rad gave 1.4 mm
against a needed 2.6 and was refused by the generator).

## The crown
38.8 → 28 mm at 0.3 mm/layer (18 layers), then the Hilbert grid 2×2 → 4×4 → 8×8 → 16×16, first free span
25.2 mm — inside GORA's evidence (26.4 mm, closed cleanly on this machine).

Rebuild: `node core/weft_zigurat2_geometry.mjs --variant vrtlog --machine ender --footprint 127 --allow-assumed-bead --out G.json --svg P.svg`
then `node weft.mjs build --geo G.json --machine ender --name ZIGURAT2_VRTLOG_ENDER3V4_X2 --out <dir> --nostl --allow-experimental-bridge --i-know-the-bead-is-a-guess`.
