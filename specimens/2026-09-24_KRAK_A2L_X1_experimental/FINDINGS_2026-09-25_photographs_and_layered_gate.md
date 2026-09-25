# Finding, 2026-09-25 — KRAK printed on both machines, read from all sixteen photographs, and what the gate learned

Written by the Svemir mind `cowork-fable-krak` (Claude) from the sixteen photographs Semir sent on
2026-09-25 (15:20–15:21), the two shipped G-code files, the recorded gate verdicts and reports, and the
new instrument `core/weft_gate_layers.js` that this failure produced. A first reading of the same
photographs by an earlier mind the same afternoon is in `journal/2026-09-25_KRAK_ISHOD_I_SLOJEVITA_KAPIJA.md`
(Serbian); this file confirms most of it, corrects two points, and adds what the photographs show
when each one is opened rather than sorted by colour. Nothing already in this folder is changed; the
receipts, gate verdicts and predictions stand as written and `outcomes.md` gets a dated section.

## 1. What Semir reports

Both prints were **stopped by Semir**, not run to the end. He did not risk the machines once the nozzle
was dragging. He also states that the object came loose by itself and went on being printed in that
state before he stopped it. There is no machine log; the layer at which each print was stopped is not
recorded.

## 2. What the sixteen photographs show, one by one

Eight photographs are of the Creality Ender-3 V4 (pink filament, CREALITY bed and gantry), eight of the
Bambu A2L (black filament, Bambu Lab toolhead, HOT SURFACE label). They were filed as
`photos/2026-09-25_KRAK_ENDER3V4_01…07, 12` and `photos/2026-09-25_KRAK_A2L_08…11, 13…16` by the
earlier mind; the numbering follows the WhatsApp timestamps.

**Bambu A2L.** Two objects lie on the plate. One is the lower drum — wall-1 with the K1 terrace on it —
**still adhered, in place, intact**: a clean woven ring with a fringe of hairpins around it
(`_A2L_13`, `_A2L_14`). The other is everything that was built above it — wall-2, terrace K2, wall-3 and
whatever was laid of K3 — as one piece, a stack of rings with two fringes, lying on its side beside
the drum (`_A2L_08`, `_A2L_09`, `_A2L_10`, `_A2L_11`, `_A2L_15`, `_A2L_16`). Loose thread wanders across the plate in long
loops, including across the inside of the drum (`_A2L_14`): extrusion laid in air after the upper part
had gone. So on the A2L **the plate held**; the object separated at the top of K1, and the upper part
was printed on for a while after it separated (its rings are regular; it was not crumpled while it
was being built).

The K1 fringe on the surviving drum shows the ten sectors as different textures, visible to the naked
eye. Sectors of plain radial hairpins lie flattest; the sectors whose legs zigzag or splay — the ones
the support gate ranked best — are the ones with tips curled up and bunched (`_A2L_13`, upper-right
sector; `_A2L_14`, right-hand sector). Prediction 3 of `PREDICTIONS.md` (the finished order will not match
the gate's order) is therefore visible, in the direction that says the gate's count of hanging thread
is not a stiffness ranking. There is no photograph from directly above, so the twin test (sector s
against s + 5) cannot be made from this record.

**Creality Ender-3 V4.** The whole object left the plate. In `_ENDER3V4_01` Semir holds it: the woven
drum is intact and clean, with the K1 fringe on it, and above it the terraces are a loose fringe of
hairpins several centimetres deep. In `_ENDER3V4_03`, `_05` and `_07` the object lies on the bed as three or four
displaced ring stacks, each with its own fringe, one above the other, off-centre; the toolhead (visible in
`_ENDER3V4_07`) is above it with thread hanging. That is an object that was dragged, printed on in its
new position, dragged again. The plate lost it; the drum did not break.

**Same driver, different weakest link.** Both objects failed from the same cause, the K1 terrace, and
each gave way at its own weakest interface — the A2L at the joint above K1, the Ender at the plate.

## 3. Two corrections to the first reading

1. *"The wall is interrupted by the terrace."* It is not. In the shipped G-code every other K1 layer
   lays the full wall ring (the `chord` role, 406.6 mm) as well as the teeth; the wall continues through
   the terrace. The A2L separated at the top of K1 because that is where the pull arrived, not because
   the ring was absent there.
2. *"The plate adhesion was overcome by the growing nest."* True of the Ender, not of the A2L, whose
   drum is still on the plate in the photographs.

## 4. The mechanism, as far as the record supports it

Semir's reading, which the photographs support: the terrace's hairpins **blossom** — the loops rise
above the plane they were laid in as they cool and shrink — and the risen loops are **hooks**. The
nozzle, printing (not travelling: the whole file has 237 travels totalling 1.9 m), passes through the
space a hook now occupies, catches it and pulls; a pulled hairpin pulls its neighbours and then the ring
they hang from. What the gate can now see of this chain is in §5. What it cannot see — how high a
given hairpin rises, and when — is the subject of PRAG and KUKA.

Which pass first hooked K1 is not recorded. Two candidates are in the file: the next K1 layer landing on
a risen tip of the layer below (0.24 mm of clearance), and the K2 castle legs crossing straight over
the never-tied top tips of K1 at 5.0–8.6 mm of clearance. The A2L photographs favour the second: the
K1 fringe on the surviving drum is tangled in places but complete, and the part that left is the part
built above it.

## 5. What the gate learned — measured, not asserted

The support gate (`core/weft_gate.js`, now called layer S1) said PASS, 0 problems, for both files. It
answers one question: is there material under this point. A new instrument, `core/weft_gate_layers.js`,
asks the others, over the same final bytes, and every limit in it was set by running it over the printed
record: the object that held (OBRTAJ, six flat terraces, 2026-09-23) and the objects that did not
(RAZMAK, nests, 2026-09-23; KRAK, both machines, 2026-09-24). The same instrument on both sides, so the
numbers are comparable.

| object (printed) | outcome | S3 median reach of loose tips, worst layer | S4 passes over loose tips ≥ 2 layers below | tips never tied |
|---|---|---|---|---|
| OBRTAJ_ENDER_H7 | held, terraces flat | **17.6 mm** (66 terrace layers, 6–17.6) | **0** | 0 |
| RAZMAK_A2L_H4 | nested at terrace 1, stopped | **30.7 mm** | 0 | — |
| KRAK_A2L_X1 | destroyed | **24.5 mm** (K1, twelve layers 22.6–24.5) | **809**, clearance 6–12 mm (K2 over K1) | 90 |
| KRAK_ENDER3V4_X1 | destroyed | **24.5 mm** | **877**, same pattern | 92 |
| LIMIT16_A2L (2026-09-04) | held | 3.0 mm | 0 | 9 (tabs) |

"Reach" is the distance from a loose tip to the nearest **solid** material of the layer below, where a
hairpin laid on a hairpin laid in air is still loose: a pile of hairpins is one cantilever however many
layers tall. The support gate sees each layer resting on the last and is blind to that, which is how
every K1 layer after the first passed it.

So the gate now has layers, each with one question, each able to refuse on its own, none able to
overrule another — the verdict is a vector:

- **S2 · quantity** — how much thread hangs. *Reports only.* The earlier reading's central number
  (512 free runs longer than 10 mm in K1) is real, but under the same instrument OBRTAJ's first
  terrace layer has **203** such runs and **6.9 m** of free thread in one layer, and it held. Quantity
  does not decide.
- **S3 · free tips** — median reach of a layer's loose tips. *Refuses* above 17.6 mm (OBRTAJ held);
  KRAK at 22.6–24.5 and RAZMAK at 30.7 are the failures. The longest tip does not decide either:
  OBRTAJ held a 37.6 mm tip, KRAK failed with none longer than 24.6. The shortest tip (OBRTAJ 2.0–3.4,
  RAZMAK 12.4, KRAK 21.7) is consistent with "short tips carry the long ones" but is one comparison,
  so it is reported, not refused.
- **S4 · overflight** — extrusion passing within the nozzle cone (≤ 2 mm laterally, evidenced on
  KRAK) over a tip that nothing has tied within two layers, at ≤ 12 mm of clearance (5.0 mm is the
  evidenced failure; the margin above it is assumed). *Refuses.* KRAK: 809 (A2L). OBRTAJ: 0 — its
  steps go inward; nothing ever flies over a fringe.
- **S5 · plate** — first-layer contact against height and lever. *Reports.* OBRTAJ 0.343 held on
  the Ender, KRAK A2L 0.352 held on the A2L, KRAK Ender 0.433 left the plate: the number is per
  machine and per plate state and cannot refuse on this record.
- **S7 · joint** — the fraction of a layer laid on material, for layers that carry the object.
  *Reports.* OBRTAJ's first terrace layer is 11.8 % carried with 939 layers above it and held.
- **S8 · stacking** — a layer laid onto itself, and the A-B-A-B repeat. *Reports.* OBRTAJ has 114
  A-B-A-B layers and printed flat; the weave rule (every layer must cross the one below) is a
  generator rule, not something this record lets the gate refuse on.
- **ORDER** — a declared risk band must be the last thing printed. *Refuses.* KRAK put K1 at the
  bottom; 49 undeclared layers stood on it, and four of six predictions were never tested.

`node weft.mjs check FILE --machine ID` now prints both verdicts; `node weft.mjs build` writes
`<name>_gate_layers.json` and refuses on S3, S4 or ORDER outside declared zones. Both KRAK files,
re-checked with the new gate: **refused** (S4, ORDER; S3 declared). OBRTAJ: **passes**.

## 6. Predictions — what this print settled

| # | prediction | verdict |
|---|---|---|
| 1 | K3 holds to 48 mm | **not tested** — destroyed below K3 |
| 2 | K2 breaks between 4.5 and 9 mm of advance | **not tested** |
| 3 | finished order on K1 ≠ the gate's order | **visible** — the gate's best-ranked shapes are the most curled; no clean specimen to rank |
| 4 | `plain` may still win on stiffness | **consistent with the photographs**, not established |
| 5 | each rung matches its twin | **not tested** — no top view |
| 6 | nothing predicts adhesion | **confirmed as a gap** — decided the Ender outcome |

The prediction nobody wrote, now with a number: a terrace whose tips have a median free reach above
17.6 mm, with extrusion passing over its untied tips at 5 mm of clearance, destroys the object.

## 7. What follows

PRAG and KUKA (`specimens/2026-09-25_*`), built by the earlier mind and re-gated here: one corbel
terrace each, the terrace last, one variable each (free span at the tip; the way a tooth ends), both
passing ORDER, their S3 medians at 22 mm sitting in the unevidenced band between OBRTAJ and KRAK —
which is the question they exist to answer.

## Honest verdict

**Looked at:** all sixteen photographs, individually; both G-code files; the reports and gate JSON.
**Measured:** every number in §5, by `core/weft_gate_layers.js` over the shipped bytes, reproducible
with `node tools/gate_layers_run.mjs`. **Inferred, not measured:** that the K2 pass over K1's tips was
the first hook (the photographs favour it; no log fixes it); that the loops rise because they cool
(Semir's reading, consistent with every photograph, unmeasured). **Not available:** the stop layer of
either print, a photograph from directly above, any mass or deflection.
