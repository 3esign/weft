# ZIGURAT2 TKANJE · A2L · X2 — the corner-cut stepped pyramid (2026-09-18)

**Status: NOT PRINTED. Experimental. Built on the measured A2L bead (0.45 mm).**
Pair of [ZIGURAT2 VRTLOG](../2026-09-18_ZIGURAT2_VRTLOG_ENDER3V4_X2_experimental/).
Supersedes the [X1 pair](../2026-09-17_ZIGURAT_TKANJE_A2L_X1_experimental/), which gave every tier its own tube
down to the plate and whose terraces stacked two identical chord layers (no crossings, no weld nodes — see
`FINDINGS_2026-09-18.md` there). Here **only the lowest tier touches the plate**; every step above it is made in
mid-air, with no support of any kind and no bridge.

| | |
|---|---|
| file to print | `ZIGURAT2_TKANJE_A2L_X2.gcode.3mf` (Bambu container) — SHA-256 in `manifest.json` / `SHA256SUMS.txt` |
| size | 192.2 × 192.2 × 120.7 mm on the 330 × 320 plate |
| layers | 503 Z levels at 0.24 mm; 582 emitted paths |
| thread | 500.3 m · 48,229 weld nodes · 22.3 m filament · 67.5 g · 8 h 14 m in the header (expect 2–3× in reality) |
| grammars | staple 94, diagonal 59, sine 46, eight 37, perp 15 — one per tier |
| gate at the declared 36 mm | PASS — 0 problems, 521,362 points, first layer 1 island; the package re-read from the container passed the same |
| gate at the evidenced 16.2 mm | **2 findings, both the crown's first chords, none anywhere in a corner cut** (`*_gate_at_16.2mm.json`) |
| self-overlaps | 28 |

## The method — `terrace-corner-cut/v1`
At the top of a tier, a 45° chord is cut across each of the four corners, between two adjacent edges. The first
chord is a few millimetres long and both of its ends land on material that is already there. Each layer cuts a
little deeper: the chord grows, its ends slide outward along the two edges (zero overhang there), and only its
middle moves inward — by 0.5 mm, which is the entire overhang of the layer. The next layer's chord crosses the
previous one at an angle, so **the crossings are weld nodes and the ramp is woven**, not stacked.

When the four cuts have grown until they meet, they meet at the midpoints of the four original edges, and what is
left is a square rotated 45° with side a/√2. One cut cycle is one step: a factor of 1.414 and a 45° rotation, both
structural. The octagon is the transition; the twist is not a decoration.

Sides: **175.6 → 124.2 → 87.8 → 62.1 → 43.9 mm**, each tier rotated 45° from the one below.

| cut | from → to (mm) | layers | rise | slope | weld columns | pleats |
|---|---|---|---|---|---|---|
| 1 | 175.6 → 124.2 | 124 | 29.8 mm | 25.6° | K 192 at 3.6 mm | 16 × 1.4 mm |
| 2 | 124.2 → 87.8 | 88 | 21.1 mm | 25.7° | K 192 at 2.5 mm | 12 × 1.4 mm |
| 3 | 87.8 → 62.1 | 62 | 14.9 mm | 25.6° | K 96 at 3.6 mm | 8 × 1.4 mm |
| 4 | 62.1 → 43.9 | 44 | 10.6 mm | 25.7° | K 96 at 2.5 mm | 8 × 1.4 mm |

**Evidence for the rate.** OBLAK's upper hemisphere is a corbel over a 254 mm void; it printed clean and went
wavy only where its per-layer step passed ~0.9 mm (photographs read 8 September). 0.5 mm here, and gentler than a
uniform corbel because the overhang tapers to nothing at both ends of every chord.

## What else holds the ramp up (in order of what it is worth)
1. the cut geometry itself — every chord lands on solid material at both ends;
2. **pleats**, a radial corrugation locked to the polar *angle* (not to arc length, so it does not slide as the
   section changes shape), running through the cut and easing 10 layers into the walls above and below, so a rib
   grows out of the wall rather than appearing 1.4 mm proud in one layer. Bending stiffness goes with the square
   of the amplitude; the amplitude is capped so the concave radius never falls under w/2 + e + bead;
3. **doubled weld columns** through the cut — twice the tabs, twice the landing points for the chord above;
4. a **deeper wall** (4.0 mm vs 3.0) and a **longer tab** (1.4 vs 0.7) through the cut — the numbers OBLAK's crown
   approach used, eased in over the same 10 layers.

Items 2–4 are reasoned, not measured. Item 1 and the rate are evidenced.

## The painting
One grammar per tier (staple, diagonal, sine, eight, perp); a quilt of pillows on each wall (11 / 8 / 5 / 2 per
face, 1.4 mm, two rows), suppressed on the ramps where the pleats take over; wall 3.4 mm at the foot, 3.0 on the
walls, 4.0 on the ramps.

## The crown — `crown-woven-grid/v1` (the only declared span)
The last square is drawn in at 0.3 mm/layer to a 30 mm hole (23 layers), then a woven grid closes it: 3×3 (first
free span 27.2 mm — the class GORA's iris closed at 26.4 mm), 9×9, 27×27; twelve layers, 2.9 mm.

## Files
`*_geometry.json.gz` · `*_report.json` · `*_gate.json` / `*_gate_at_16.2mm.json` / `*_package_gate.json` ·
`*_preview.png|svg` (oblique stack, the plan with every cut, and the true silhouette — greatest and least radius
per layer, which is the only honest way to draw a corner cut) · `manifest.json` · `SHA256SUMS.txt` ·
`PREDICTIONS.md` · `PROTOCOL.md` · `build.log`.

Rebuild (Node only): `node core/weft_zigurat2_geometry.mjs --variant tkanje --machine a2l --footprint 193 --out G.json --svg P.svg`
then `node weft.mjs build --geo G.json --machine a2l --name ZIGURAT2_TKANJE_A2L_X2 --out <dir> --nostl --allow-experimental-bridge`.
