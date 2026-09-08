# GORA Ender-3 V4 X1 — physical outcome (read 8 September 2026)

Evidence: nine photographs by Semir (Galaxy S23 FE; EXIF 5 September 15:06 and 20:39, 6 September 12:19, 9 September
00:11–00:12 local), received in the Cowork chat on 8 September and archived unchanged with SHA-256 in
`photos/2026-09-08_semir/manifest.json`. Read by: `svemir-claude-fable-cowork` — every frame opened at full resolution.
Artifact: `GORA_ENDER3V4_X1_routeB.gcode` (SHA-256 `aa7b687e…`, re-verified against `manifest.json` in the cloud the same
day). Binding: clear body on yellow first layers, the Creality bed in frame, and the unique geometry (four horns, four
windows, chimney top with the iris); no printer-history receipt. The Ender bead is still ASSUMED (0.42 mm; C1 never printed).

**Headline: GORA printed to full height (191.2 mm, 956 Z levels) on the Ender-3 V4 on an assumed bead and stands on the
plate.** First layers at 15:07 on 5 September (frame 01), mid-height at 20:39 (02), complete by 12:19 on 6 September (03) —
at most 21 hours. The woven-iris crown closed as a clean triangular mesh. One horn tip frayed and tore a small hole below it.

## Answers to `PREDICTIONS.md` (written 5 September, never rewritten)

| # | instrument | prediction (confidence) | what the photographs show | verdict |
|---|---|---|---|---|
| 1 | Foundation (rounded square, rings + spokes, one island) | holds (medium-high) | frame 01: rings, spokes and the wall's first layers as one connected piece in yellow; the yellow brim is intact under the finished object (03–05) | **confirmed** |
| 2 | Body at full height on the assumed bead | prints; rungs slightly open or over-fused (medium) | full height, no dropped layer; the wall reads as a dense, regular lattice; at this scale the rungs look neither open nor over-fused | **confirmed**; bead still unmeasured |
| 3 | Twist 0.2 | corners spiral cleanly (high) | the twisted square is legible from the front (03–05) | **confirmed** |
| 4 | Windows 20/30/40/50, jambs | jambs clean; 20 mm control no visible sag (medium-high) | the two windows in frame (front and left face) have clean jambs and flat tops; strings cross the openings from the jambs (see *Travel*) | **confirmed** for the windows seen |
| 5 | Lintel 30 | sag ≤ 3 mm (medium) | no hanging rail on any window in any frame | **held**; sag not measured |
| 6 | Lintel 40 | sag 3–6 mm, possibly one strand down (low-medium) | as above | **held**, better than predicted |
| 7 | Lintel 50 | likely partial failure, a hanging rail (low) | as above; the wide front window (03) is intact edge to edge | **held**, better than predicted |
| 8 | Horns 20/30/40/50 | 20 and 30 clean; 40 droops or curls; 50 the likely loss (low-medium) | all four horns reached their projection (03–05, 07–09); one intact tip seen from the side (08) and one from below with a fringe of separated loops along its edge (07); **one tip frayed** into loose loops with a small hole in the wall directly under it — a few rungs missing (09). Which horn is which is not readable from the frames; by the failure order in the prediction it is the 50 or the 40 | **mostly confirmed**; failure mode was fraying + a local tear, not droop or curl |
| 9 | Crown approach (square shrinking to the 31 mm hole) | prints (medium) | the rim around the hole is regular; the tabs around it are evenly spaced (06) | **confirmed** |
| 10 | Crown iris v1 (first span 26.4 mm) | first chords sag but hold; star closes with 4–7 mm openings (low-medium) | a taut triangular mesh of straight chords in three directions over the whole hole, no visible sag, openings ≈ 8 mm by eye (06) | **confirmed**, cleaner than predicted |
| 11 | Overall | completes in 14–20 h; stands; reads as tent/bell (medium) | complete in ≤ 21 h; stands; reads as a tent with a chimney | **confirmed** |

Falsifiers named in the predictions — a failure below z 39, or an under-fused wall separating at a jamb — did not occur.
The assumed bead therefore did not falsify GORA; it also was not measured by it.

## Measured from the printed file (not from the photographs)

**Travel through the void.** In the window band (z 39–84) the thread is cut at every window: 584 travel moves ≥ 20 mm,
32.4 m in total, all with retraction (0.8 mm) and z-hop (0.4 mm). Lengths: 45 at 5–25 mm, 134 at 25–45, 180 at 45–65,
202 at 65–100 (across the interior of a 134 mm body) and 23 at 100–150. Up to four travels per layer with four windows
open. The strings in the openings and the small tangle at the window corner (05, 09) are these travels; the gate does not
see them. Same fix as for OBLAK: continue each layer from the last arc and order the arcs so consecutive arcs share a
window.

**Crown approach.** The section shrinks by 0.11 mm per chord layer all the way to the hole (inner rail 16.95 → 13.19 mm
over z 176–190); no aggressive inward step, no tab-supported rings. This is why GORA's iris sits on a clean rim and
OBLAK's does not: the iris primitive is the same, the rim it was given is not.

## Not measured
Lintel sag, horn droop, mass, the hole and the mesh openings in mm, which horn frayed, filament, temperatures. Frames 03–05
are the front and one flank; two faces (two windows, two horns) have no frame of their own.

## What this changes in the record
- `README.md` here and `SCULPTURES_2026-09-05.md` say "NOT PRINTED"; not true since 6 September. This file is the answer;
  the folder keeps its name until Semir renames it `_physical`.
- `evidence/SPECIMEN_LEDGER.md` gains a row (GORA, Ender-3 V4, route B plain G-code, 5–6 September).
- The Ender's evidence base grows from LIMIT16 + Vrtlog to a 191 mm body with 20–50 mm lintels held — still on an assumed
  bead; C1 remains the cheapest unprinted experiment in the project.

## Honest verdict
Checked: nine frames at full resolution; SHA-256 of the archived copies and of the printed G-code; travel and crown numbers
recomputed from that G-code. Concluded, not measured: "held" for lintels means no hanging rail is visible from outside;
the ≈ 8 mm mesh opening is an eye estimate against the 31 mm hole. Not seen: the back and right faces, any underside,
the object off the plate.
