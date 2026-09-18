# ZIGURAT VRTLOG · Ender-3 V4 · X1 — the wrung stepped pyramid (2026-09-17)

**Status: NOT PRINTED. Experimental. Built on an ASSUMED bead (0.42 mm; C1 never printed).**
Pair of [ZIGURAT TKANJE](../2026-09-17_ZIGURAT_TKANJE_A2L_X1_experimental/) — the same construction on the A2L, four tiers, a different painting.

| | |
|---|---|
| file to print | `ZIGURAT_VRTLOG_ENDER3V4_X1.gcode` (plain G-code, the Ender's harvested start/end blocks) — SHA-256 `a9e519f5103d1a857c17cf79e76e2eab6e69afaa63da8b8ca2945236ce19490e`; arrives in two parts under `_transfer/` — run `REASSEMBLE.cmd` there, it prints the hash |
| size | 189.6 × 189.6 × 104.4 mm on the 220 × 220 plate (15 mm margin) |
| layers | 522 Z levels at 0.20 mm; 1263 emitted paths (up to 4 bodies per level) |
| thread | 695.2 m · 47,184 weld nodes · 23.3 m filament · 70.8 g · kinematic lower bound 6.4 h in the emitter, 11.4 h in the header (expect 2–3× in reality: GORA's 583 m took ≤ 21 h) |
| grammars (web layers) | sine 255, staple 267 (the hidden tube lengths and the rims) |
| gate at the declared 52 mm | PASS — 0 floating, 0 long bridge, 0 cantilever, 670,501 points, first layer 1 island (`*_gate.json`) |
| gate at the evidenced 16.2 mm | 114 findings, **all inside declared zones**: terrace 1 first radial layer 65, terrace 2 first radial layer 39, one horn flank, the roof's first levels 9 (`*_gate_at_16.2mm.json`) |
| self-overlaps reported by the emitter | 0 |

## The body — three concentric tubes founded on the bed
Rounded-square tubes with centreline sides 172.6 / 112.2 / 51.8 mm (corners 8.6 / 8 / 8), all starting on the first
layer as one island (rings and spokes around each, ribs across each gap, a 2×2 floor cross inside the innermost, a 6 mm
brim outside). Tube 0 ends at z 34 (tier 1), tube 1 at z 68 (tier 2), tube 2 at z 102 with the roof on top. Where a tube
ends, a six-layer **terrace** bridges the 30.2 mm gap to the next tube; the innermost closes with a twelve-layer grid roof.
Everything a tube does below the terrace of the tube outside it is hidden: plain staple at half the weld columns. What is
visible carries the painting:

- **sine** grammar on every tier (weld columns 3.5 / 4.5 / 4.0 mm apart);
- a **wave that climbs** — 1.4 mm relief, four waves round the perimeter, rising 24 mm per turn, helical;
- the base tier stands square to the plate, the middle tier is **wrung an eighth of a turn** (45° over 34 mm — the
  corners move 0.40 mm per layer, half the horn rate that printed on GORA), the top tier wrung **back** an eighth;
  the weld columns are helices; tube 2 stands rotated 45° inside tube 1 from the bed up (a moiré through the lattice);
- the wall breathes (a width wave of a quarter of the wall, one wave per face);
- four **8 mm horns** on the top tube's corners at z 83–88 (0.8 mm/layer, gentle flanks — the concave radius at a horn's
  base is 2·half²/(P·π²) and must clear w/2 + e + bead).

## The terraces — `terrace-woven-annulus/v1` (experimental)
Six layers each, every layer resting on the layer immediately below (the gate's rule):
1–2. **radial** chords from the ending rim across the gap to the standing wall, 9 mm apart along the rim (perpendicular
on the sides; a fan converging on the inner corner across the corners) — side chords 30.3 mm, corner diagonals 45–46 mm:
the only spans beyond the evidence; the second layer lies on the first;
3. a **4-turn square spiral** along the annulus from rim to wall, resting on the radials every 9 mm;
4. **fine radials** 3 mm apart resting on the spiral's loops (7.6 mm);
5. an **8-turn spiral** resting on the fine radials (3 mm);
6. **diamonds** ±45° across the side strips and anti-diagonals across the corner squares, resting on the loops (3.8 mm) —
terrace 1; terrace 2's strips are shorter than the gap, so it ends with fine radials again.
Two travels per layer (rim ring → chords → next ring), eight on the diamond layer.

## The roof — `crown-woven-grid/v1` (experimental)
Hilbert refinement on the 49 mm clear span of the top tube: 2×2 (one full-span chord per direction: two X layers on
each other, then two Y), 4×4 (spans 24.5 → 12.2), 8×8 (12.2 → 6.1), 16×16 (6.1 → 3.1). Each roof layer is the woven rim
ring plus one continuous serpentine (chord, a hop along the outer rail by one pitch, chord back). Twelve layers, 2.4 mm.
The 49 mm first chord is the longest single span on the object; from the 8×8 level on, every span is inside the
qualified 16 mm.

## Files
`ZIGURAT_VRTLOG_ENDER3V4_X1_geometry.json.gz` (the level-2 geometry the chain consumed, gzipped) · `*_report.json`
(emitter report incl. `gateAtEvidencedCeiling`) · `*_gate.json` / `*_gate_at_16.2mm.json` · `*_preview.png|svg`
(oblique stack + the roof and terraces from above) · `manifest.json` (receipt with SHA-256 of every file) ·
`SHA256SUMS.txt` · `PREDICTIONS.md` (written before printing) · `PROTOCOL.md` (print, photograph, measure) ·
`build.log` · `_transfer/` (the parts the G-code crossed the bridge in + `REASSEMBLE.cmd`).

Rebuild (Node only, no Python, no browser except for the preview PNG):
`node core/weft_ziggurat_geometry.mjs --variant vrtlog --machine ender --allow-assumed-bead --out G.json --svg P.svg`
then `node weft.mjs build --geo G.json --machine ender --name ZIGURAT_VRTLOG_ENDER3V4_X1 --out <dir> --nostl --allow-experimental-bridge --i-know-the-bead-is-a-guess`.
