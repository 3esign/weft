# MERA A2L 4x4 · physical outcome

Evidence received 2026-09-04 from Semir: sixteen unique photographs of the green, shallow MERA plate printed
before the 2026-09-04 LIMIT16 pair. This is not evidence from either LIMIT16 print. The originals and their
SHA-256 hashes are archived in `photos/2026-09-04_semir/`.

The photographs establish the design family, but not whether the machine was sent
`MERA_A2L_4x4_v1_A2L.gcode.3mf` or `PRINT_MERA_A2L_4x4_v2.gcode.3mf`; both live in this folder and the image
metadata contains no artifact hash. Do not attach this physical result to one of those two hashes without a
printer-history receipt.

## Physical verdict

- The photographed bodies reached real height. The earlier failure where Bambu Studio showed every body on
  layer 1 is therefore absent from the executed job: multi-body global Z worked in plastic.
- Annular foundations and grid connectors visible in the frames remained attached to the textured plate.
  There is no whole-plate overhead frame, so the photographs cannot independently prove that all sixteen
  foundations formed one connected first-layer island.
- The wall bodies stand. Circular, leaning and non-circular contours remain legible; no catastrophic fused
  corner knot or whole-body collapse is visible.
- The supplied views most consistently group the four membrane cells as **one mostly formed membrane and
  three collapsed centres containing loose coils / spaghetti**. The formed one still has a central defect and
  is not a clean 4/4 success.
- Stringing exists across open interiors, but it is secondary to the membrane collapse.

## Result by experiment row

| row | intended question | evidence-backed result |
|---|---|---|
| 1 | lean 0 / 8 / 15 / 22 degrees | candidate bodies for the full range remain standing; stronger profiles show more openness and local roughness, but isolated frames do not prove an exact angle-to-frame mapping |
| 2 | staple / perpendicular / diagonal / sine | distinct wall textures survive without gross wall collapse; the supplied angles are insufficient for a defensible per-grammar score |
| 3 | four rim-anchored membranes | approximately 1/4 mostly formed and 3/4 collapsed into central loose filament; exact circle-core identity is not readable, and cropped frames do not justify assigning every failure to IDs 09-12 by filename |
| 4 | ellipse / rounded square / peanut / clover | non-circular open bodies are recognizable and upright; pointed/zig-zag upper edges are rough locally, with no catastrophic corner knot visible |

## The important contradiction

The final-artifact gate reported four membranes with geometric anchoring `1.000`. The plastic did not return
four working membranes. The gate proved that the first outer turn overlaps material from the layer below and
that neighbouring spiral turns are close in XY. It did **not** prove that a hot, same-layer inward-growing
strand can carry the next strand across the void. Therefore:

> `PASS` for this artifact is a geometric-support verdict, not a physical-printability verdict.

The next membrane comparison should keep the same rim and span while separating three constructions:
single-layer inward spiral, straight rim-to-rim bridge lines, and a multi-layer inward corbel. The 18 mm
single-layer membrane in LIMIT16 remains an intentional experiment, not a qualified production primitive.

## Honest scope

The sixteen files are photographs, not sixteen proven cell IDs: several are repeat angles of the same body,
and the foundation hash marks encode only the column. There is no complete overhead plate, underside view,
caliper reading, strength test or printer-history artifact hash. Claims above therefore stay at row/feature
level. Exact per-cell membrane identity, bead width, sag in millimetres and removal strength remain unknown.

