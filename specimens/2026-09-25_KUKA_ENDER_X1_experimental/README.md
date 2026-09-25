# KUKA_ENDER_X1 — KUKA — the end-condition ladder: is it the free length that kills, or the free end?

**Print `KUKA_ENDER_X1.gcode` from this folder.** Machine: Creality Ender-3 V4. Layer height 0.2 mm.

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
legs, the same 2.5 mm advance, the same 22 mm reach and the same **6 mm** free span at the tip (well
under the evidenced 16.2 mm bridge ceiling); the only thing that changes is **how the tooth ends**:

| sector | end condition | what it is |
|---|---|---|
| 0, 5 | `zatvoren` | the corbel tooth as it is: out, across, back — no free end anywhere |
| 1, 6 | `kuka` | the same tooth with the leg overshooting the tip arc by 3 mm and turning back: every tooth carries one unsupported hairpin apex, the KRAK K1 condition, isolated |
| 2, 7 | `rebro` | the same tooth plus a circumferential rib at the radius the layer below reached, landing on that layer's tips and tying every leg just laid |
| 3, 8 | `dupli` | the same tooth laid twice onto itself inside one layer — the 2026-09-19 ziggurat's self-stacking, which the printed OBRTAJ says is what made it stiff |
| 4, 9 | `koren` | the same tooth whose return leg runs all the way in to the wall ring, so each tooth is anchored deep rather than at its own root |

If the `kuka` sectors curl and the `zatvoren` sectors do not, at the same span, then it is the free
end and not the free length that makes a hook — which is what the KRAK photographs suggest and
nothing has yet isolated.

## The ladder

| sector | end | teeth | twin |
|---|---|---|---|


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
| machine | Creality Ender-3 V4 |
| terrace | z 18–20.2 mm, 11 layers, advance 2.5 mm/layer, reach 22 mm |
| drum | 18 mm woven wall, then the terrace, then a 2-layer collar |
| thread path | 131 m |
| estimated time | 1.21 h (kinematic, a lower bound) |
| support gate S1 | PASS at the declared ceiling; second gate at 16.2 mm: all findings inside the terrace zone |
| layered gate | S2 INFO · S3 DECLARED · S4 DECLARED · S5 INFO · S7 INFO · S8 WARN · ORDER PASS |

`KUKA_ENDER_X1_plan.svg` draws the ten sectors with their rungs.
