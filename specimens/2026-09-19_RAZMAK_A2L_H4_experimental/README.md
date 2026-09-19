# RAZMAK · Bambu A2L / four levels

Two purposes: a distinct stepped sculpture and an aggressive horizontal-WEFT experiment. **Generated and digitally checked; NOT PRINTED.** [Current outcome](outcomes.md) · [Predictions and observations](PREDICTIONS.md) · [Rebuild protocol](PROTOCOL.md).

![Nominal emitted paths](RAZMAK_A2L_H4_preview.png)

## Files

- **Print with the preserved WEFT order:** [RAZMAK_A2L_H4.gcode.3mf](RAZMAK_A2L_H4.gcode.3mf). The companion plain G-code is also included. The packed container was re-read and gated.
- [Interactive offline review](preview.html): rotate, front/roof views and a height slider. Walls are sampled every eighth layer for visibility; the STL and printer file contain all layers. Colours identify regions in the preview, not filament changes.
- [STL reference](RAZMAK_A2L_H4_reference.stl): 390.9 MB, all emitted bead ribbons. Re-slicing this reference changes the WEFT deposition order; the supplied G-code is the ordered experiment.
- [Editable geometry](RAZMAK_A2L_H4_geometry.json) and compressed copy; [final audit](FINAL_AUDIT.json), [complete evidenced-ceiling report](RAZMAK_A2L_H4_gate_at_16.2mm_full.json), [delivery hashes](DELIVERY_MANIFEST.json).

## Dimensions and process

Nominal deposited envelope **299.92 × 289.92 × 309.84 mm**; allowed envelope 300 × 290 × 310 mm. Bed-edge clearance is at least 15.04 mm; clearance above the object is 15.16 mm. The STL mitered corners also remain inside the 15 mm margin. Model clearance excludes the printer's preparation and parking movements.

1291 Z levels at 0.24 mm. Nozzle profile 0.4 mm; nominal bead 0.45 mm, first-layer bead 0.52 mm; 220 °C / bed 55 °C. The A2L bead has prior completion evidence; that is not a new caliper measurement.

Only the basal perimeter frame touches the bed. The 3 annular terraces hold a fixed footprint for twelve layers each, shift the return pattern by a quarter-cell between layers, and carry each subsequent wall. They project both inward and outward, without bed-founded interior tubes. There are 4 wall levels; the closed roof is the final horizontal surface.

| Wall | Plan | Z extent, mm | Rotation | Texture and repeating layer roles |
|---|---|---|---|---|
| 1 | Rounded square | 0–72 | 0 → 5° | staple; chord / web |
| 2 | Rounded hexagon | 74.88–152.88 | 15 → 45° | diagonal; chord / web |
| 3 | Rounded square | 155.76–233.76 | -12 → 24° | sine; chord / web |
| 4 | Ellipse | 236.64–303.84 | 10 → 70° | eight; chord / web / web |

| Terrace | Nominal bottom–top, mm | Print layer numbers (one-based) | Return cells/layer | All findings at 16.2 mm |
|---|---|---|---|---|
| terrace-1 | 72–74.88 | 301–312 | 140 | 3360 |
| terrace-2 | 152.88–155.76 | 638–649 | 128 | 1232 |
| terrace-3 | 233.76–236.64 | 975–986 | 60 | 1342 |

The roof alternates X/Y grids through pitches 10, 5, 2.5 and 1.2 mm, then two dense crossed layers at 0.405 mm pitch. A seven-layer raised 4-lobed growing wave finishes it. [Roof view](RAZMAK_A2L_H4_roof.png). The coverage audit sampled 141,679 interior points at 0.2 mm spacing and found 0 uncovered points at nominal bead width. This is a digital coverage check, not a watertightness or physical-print claim.

Object-only estimates from extruding moves: 77.01 m of 1.75 mm filament, approximately 233.39 g at assumed density 1.26 g/cm³. Kinematic time is **at least 29.664 h**, without acceleration, heating, waits or firmware macros; it is not the machine's completion-time prediction. Total deposited path length is 1824.1 m and must not be confused with filament feed length.

## Validation and limits

First-layer audit: **3522 actual model extrusion segments at Z0.24 mm**, with the first preview deposition at the same height. Startup/purge is marked as preparation/wipe without changing printer commands. [Correction and command identity](FIRST_LAYER_REPAIR.json). The same shared export guard applies to this Bambu file and its container. Native slicer UI was not operated during verification.

Final G-code gate: PASS, 0 problems, 2,360,817 checked points. Declared ceiling 180 mm, cantilever limit 4.8 mm, ordinary support tolerance 0.6 mm. The packed G-code was independently re-read and passed the same gate. Its thumbnails identify this model. The slicer-owned end-Z formula was restored from the archived container: model top + 0.4 = 310.24 mm.

The **complete** 16.2 mm check records 5943 findings, all inside explicitly declared narrow terrace/roof zones; zero outside. These are admitted experiments beyond prior evidence, not proven printable spans. Every finding is retained and reviewed; the final file's identity is checked in FINAL_AUDIT. Independent declared, evidenced and package passes use the existing WEFT gate in separate workers; files remain PENDING until all required checks pass.

Wall, terrace and art overlap findings: zero. The raw thread report also records 240 contacts in the final two dense roof layers; these are intentional adjacent fill overlaps and remain visible in the report. No gate exemptions were added to hide them. Geometric crossings do not establish weld quality. A returning free-tip loop can pass the bridge classification while remaining a mechanical cantilever challenge.

Honest verdict: machine-profile dimensions, emitted planar layers, hollow basal support, nominal roof coverage, overlap locations, final support gates and artifact identities were checked. Counterweight benefit, tension, thermal behaviour, sag, strength and physical completion remain unmeasured. No printer upload or print was initiated.
