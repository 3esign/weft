# PRAG_A2L_X1 — PRAG — the free-span ladder: how far may thread go before it touches something again?

**Print `PRAG_A2L_X1.gcode.3mf` from this folder.** Machine: Bambu A2L. Layer height 0.24 mm.

## Why this object exists

KRAK was printed on both machines on 2026-09-24 and both copies were destroyed
(`../2026-09-24_KRAK_*/FINDINGS_2026-09-25_photographs_and_layered_gate.md`). Two errors of experiment
design are corrected here, and one question is asked at a time.

1. **The riskiest band is the last thing printed.** KRAK's heroic terrace K1 sat at the bottom; when it
   tangled it took the two corbel terraces above it and four of its six predictions were never tested.
   Here the drum below the terrace is a finished object before the terrace begins. If the terrace
   tangles, stop: nothing below it is lost and every sector that held can still be read.
2. **One variable.** KRAK varied tooth shape, corbel advance and reach at once. This object varies
   exactly one quantity across ten 36° sectors, sector s paired with sector s + 5.

One corbel terrace, the last thing printed on an 18 mm woven drum. Every sector has the same radial
legs, the same 2.5 mm advance per layer and the same 22 mm reach; the only thing that changes from
sector to sector is the **circumferential gap at the tip**: 3, 6, 9, 13 and 18 mm. Each rung is printed
twice, 180 degrees apart, so a difference between twins belongs to the machine (part cooling, bed
temperature gradient), not to the design.

The question it puts a number on: at which free span does a corbel tooth stop being a shelf and start
being a hook? The woven walls of every printed object survive at spans under 5 mm; KRAK's terrace K1
died with tips at 24 mm. The ladder brackets that interval on one object.

## The ladder

| sector | tip gap (mm) | teeth | twin |
|---|---|---|---|
| 0 | 3 | 8 | 5 |
| 1 | 6 | 5 | 6 |
| 2 | 9 | 4 | 7 |
| 3 | 13 | 3 | 8 |
| 4 | 18 | 2 | 9 |
| 5 | 3 | 8 | 0 |
| 6 | 6 | 5 | 1 |
| 7 | 9 | 4 | 2 |
| 8 | 13 | 3 | 3 |
| 9 | 18 | 2 | 4 |

## Where this object sits against the evidence

The layered gate (`core/weft_gate_layers.js`, calibrated on the printed record on 2026-09-25) reads
this file as: **S3 declared, S4 declared, ORDER pass**. In words: the terrace's loose tips reach a
median of 20.7 mm to solid material, which is *between* the 17.6 mm that held on OBRTAJ and the
22.6–24.5 mm that destroyed KRAK — the unevidenced band, and exactly the band this object exists to
measure; the passes of one terrace layer over the previous layer's tips are the corbel's own stacking
(1.6–1.7 mm of clearance), declared inside the terrace zone; and nothing undeclared stands above
the terrace except a two-layer collar. The support gate S1 passes at the declared ceiling and every
finding at the evidenced 16.2 mm ceiling lies inside the declared terrace zone.

## Build figures

| | |
|---|---|
| machine | Bambu A2L |
| terrace | z 18–20.64 mm, 11 layers, advance 2.5 mm/layer, reach 22 mm |
| drum | 18 mm woven wall, then the terrace, then a 2-layer collar |
| thread path | 109 m |
| estimated time | 1.01 h (kinematic, a lower bound) |
| support gate S1 | PASS at the declared ceiling; second gate at 16.2 mm: all findings inside the terrace zone |
| layered gate | S2 INFO · S3 DECLARED · S4 DECLARED · S5 INFO · S7 INFO · S8 WARN · ORDER PASS |

`PRAG_A2L_X1_plan.svg` draws the ten sectors with their rungs.
