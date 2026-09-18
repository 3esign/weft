# ZIGURAT TKANJE · A2L · X1 — the sampler stepped pyramid (2026-09-17)

**Status: NOT PRINTED. Experimental. Built on the measured A2L bead (0.45 mm).**
Pair of [ZIGURAT VRTLOG](../2026-09-17_ZIGURAT_VRTLOG_ENDER3V4_X1_experimental/) — the same construction on the Ender, three tiers, a different painting.
The largest WEFT object so far: 1.75 × OBLAK's thread.

| | |
|---|---|
| file to print | `ZIGURAT_TKANJE_A2L_X1.gcode.3mf` (Bambu container; the plain G-code is inside it and beside it) — SHA-256 in `manifest.json` / `SHA256SUMS.txt`; files over 19 MB arrive in parts under `_transfer/` — run `REASSEMBLE.cmd` there, it prints the hashes |
| size | 289.6 × 289.6 × 159.6 mm on the 330 × 320 plate (15 mm margin on the short side) |
| layers | 665 Z levels at 0.24 mm; 2046 emitted paths (up to 5 bodies per level) |
| thread | 1720.4 m · 132,365 weld nodes · 73.9 m filament · 223.8 g · kinematic 26.7 h in the header (expect 2–3× in reality: OBLAK's 990 m took ≤ 30 h) |
| grammars (web layers) | staple (tier 1 + hidden lengths + rims), diagonal (tier 2), sine (tier 3), eight (tier 4) |
| gate at the declared 60 mm | PASS — 0 floating, 0 long bridge, 0 cantilever, 1,817,094 points, first layer 1 island (`*_gate.json`); the package re-read from the container passed the same |
| gate at the evidenced 16.2 mm | 263 findings, **all inside declared zones**: the first radial layer of terrace 1 (108 chords, 30–42 mm) + 2 marginal diamonds, terrace 2 (76, 29–46), terrace 3 (45, 30–45), the roof's first levels 32 (two 55 mm chords, then 17 mm spans) (`*_gate_at_16.2mm.json`) |
| self-overlaps reported by the emitter | 0 |

## The body — four concentric tubes founded on the bed
Rounded-square tubes with centreline sides 272.6 / 201.7 / 130.9 / 60.0 mm (corners 10 / 10 / 8 / 8), all on the first
layer as one island (rings and spokes around each, ribs across each gap, a 3×3 floor grid inside the innermost, a 6 mm
brim outside). Tube 0 ends at z 39.1 (tier 1), tube 1 at 78.2, tube 2 at 117.4, tube 3 at 156.7 with the roof on top.
Where a tube ends, a six-layer **terrace** bridges the 35.4 mm gap to the next tube; the innermost closes with a
twelve-layer grid roof. Hidden tube lengths are plain staple at half the weld columns. The visible skin of every tier
is its own painting:

- one **grammar per tier** — staple (5.6 mm columns), diagonal (4.1), sine (2.7), eight (2.4): a sampler, every band a
  different stitch;
- a **quilt of pillows** that scales with the tier — 11 / 8 / 5 / 2 per face, two rows each, 1.4 mm high, smooth
  (1−cos)/2 bumps that vanish on every edge and corner;
- a **twist that accelerates upward** — 0°, 15°, 30°, 45° per tier, a quarter turn in all; the base stands square to the
  plate (a rotated square does not fit the footprint), each inner tube starts at the angle the tube outside it ends,
  so the outside reads as one continuous spiral and the hidden tubes stand rotated inside their neighbours;
- the wall breathes (a width wave of 0.15 of the wall, one wave per face); wall 3.4 mm at the foot, 3.0 above.

## The terraces — `terrace-woven-annulus/v1` (experimental)
Six layers each, every layer resting on the layer immediately below (the gate's rule — learned when a first schedule
that rested fine chords on radials four layers down was refused at 16.2 mm):
1–2. **radial** chords from the ending rim across the gap to the standing wall, 9 mm apart along the rim (perpendicular
on the sides; a fan converging on the inner corner across the corners) — side chords 35.5 mm, corner diagonals 51–53 mm:
the only spans beyond the evidence; the second layer lies on the first;
3. a **4-turn square spiral** along the annulus from rim to wall, resting on the radials every 9 mm;
4. **fine radials** 3 mm apart (a 9 mm fan at the corners) resting on the spiral's loops (8.9 mm);
5. an **8-turn spiral** resting on the fine radials (3 mm);
6. **diamonds** ±45° across the side strips and anti-diagonals across the corners, resting on the loops (4.4 mm) —
terraces 1 and 2; terrace 3's strips are shorter than the gap, so it ends with fine radials again.

## The roof — `crown-woven-grid/v1` (experimental)
Peano refinement on the 57 mm clear span of the top tube: 3×3 (two full-span chords per direction: two X layers on
each other, then two Y — the gate measured 54.9 mm), 9×9 (spans 19 → 6.4; measured 17), 27×27 (6.4 → 2.1). Each roof
layer is the woven rim ring plus one continuous serpentine. Twelve layers, 2.9 mm. From the second 9×9 layer on, every
span is inside the qualified 16 mm.

## Files
`ZIGURAT_TKANJE_A2L_X1_geometry.json.gz` (the level-2 geometry the chain consumed, gzipped; 34 MB plain) ·
`*_report.json` · `*_gate.json` / `*_gate_at_16.2mm.json` / `*_package_gate.json` · `*_preview.png|svg` ·
`manifest.json` (receipt with SHA-256 of every file) · `SHA256SUMS.txt` · `PREDICTIONS.md` · `PROTOCOL.md` ·
`build.log` · `_transfer/` (parts + `REASSEMBLE.cmd`).

Rebuild (Node only): `node core/weft_ziggurat_geometry.mjs --variant tkanje --machine a2l --out G.json --svg P.svg`
then `node weft.mjs build --geo G.json --machine a2l --name ZIGURAT_TKANJE_A2L_X1 --out <dir> --nostl --allow-experimental-bridge`.
