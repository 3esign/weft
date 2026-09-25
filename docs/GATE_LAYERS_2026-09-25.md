# The layered gate — what KRAK taught the gate (2026-09-25)

`core/weft_gate_layers.js` · `node weft.mjs check` · `node weft.mjs build` · `index.html` (Download G-code, gated)
· test: `tests/gate_layers.test.mjs` · runner: `tools/gate_layers_run.mjs`

## Why

On 2026-09-24 KRAK was printed on both machines and both copies were destroyed, and the support gate
(`core/weft_gate.js`, `check_gcode.py`) had said **PASS, 0 problems** for both files. That gate — called
**S1** from now on — answers one question: *is there material under this point*. It answered it
correctly. The object died of questions it does not ask.

Read from the sixteen photographs and Semir's report
(`specimens/2026-09-24_KRAK_*/FINDINGS_2026-09-25_photographs_and_layered_gate.md`): the terrace's
returning hairpins **blossom** — the loops rise above the plane they were laid in — and a risen loop
is a **hook**. The nozzle, printing, passes through the space the hook now occupies, catches it and
drags; on the A2L the object sheared at the top of the terrace, on the Ender it left the plate. Semir
stopped both.

## The principle: layers, not a hierarchy

Each layer below asks ONE question, measures ONE quantity over the final G-code bytes, and judges it
against the printed record. The layers are not ranks: any layer may refuse on its own, no layer can
overrule another, and the result is a **vector** of verdicts —

    S2 INFO · S3 FAIL · S4 FAIL · S5 INFO · S7 INFO · S8 WARN · ORDER FAIL

— not one PASS. Had the layers been ranked with S1 on top, KRAK would have passed, which is what
happened.

| layer | question | quantity | verdict |
|---|---|---|---|
| **S1** support (`weft_gate.js`) | is there material under this point | distance to material below; bridges, cantilevers, membranes, islands | refuses (unchanged) |
| **S2** quantity | how much thread hangs | free runs > 10 mm per layer, free metres, longest run | **reports** — falsified as a discriminator, see below |
| **S3** free tips | how far a loose tip reaches, and is it ever tied | median reach of a layer's loose tips to SOLID material; tips never tied | **refuses** above 17.6 mm |
| **S4** overflight | does extrusion pass over a tip nothing tied | passes within the nozzle cone over untied tips ≥ 2 layers below | **refuses** at ≤ 12 mm clearance |
| **S5** plate | what holds the object against what is built above it | first-layer contact / (height × lever) | reports; refuses only against a given printed failure |
| **S7** joint | is a carrying layer laid on points | fraction of a layer on material, layers with ≥ 20 above | reports |
| **S8** stacking | does every layer cross the one below | fraction within a quarter bead of the layer below; A-B-A-B period; crossing angles | reports |
| **ORDER** | is the risk band the last thing printed | undeclared layers above a zone that absorbed findings | **refuses** |

### Loose material stays loose

The one idea that made S3 and S4 see what S1 cannot: **material that stands only on loose material is
loose.** A hairpin laid on a hairpin laid in air is a cantilever pile however many layers tall; S1
sees each layer resting on the last and is blind to that, which is how every K1 layer of KRAK after
the first passed it. The instrument keeps, per cell of the layer below, a *depth*: 0 for solid,
1 for a hairpin or free end laid in air, n + 1 for a hairpin laid on depth n. Depth propagates only
through hairpin and free-end piles — a woven V between two crossings is a bridge and stays solid,
and a wall ring laid over the top of a terrace starts again at 0 (whether it holds is S4's and S7's
question). A pile 12 layers deep is taken as consolidated: the terraces that printed flat on OBRTAJ
are 12 layers of hairpins. That number is an assumption drawn from one held object.

"Reach" of a loose tip is its distance to the nearest **solid** material of the layer below, so the
twelfth hairpin of a pile reaches as far as the first. A tip is **tied** when the next layer or the
one after lays material within 1.5 mm of its apex (a thread crossing the loop's legs that close to the
apex is a weld on the tip); material laid higher over the same XY is not a tie but an overflight.

### Declared zones and ORDER

An experiment declares its risk bands in `summary.experiments.zones` (`{name, z0, z1, declares?}`),
exactly as it already does for the S1 second gate at the evidenced 16.2 mm ceiling. A finding inside a
zone that declares its layer is **DECLARED**, not refusing. ORDER then insists that nothing undeclared
stands above such a zone except a closing pass of at most 1 mm (`--above-risk`): KRAK put its riskiest
terrace at the bottom, 49 undeclared layers stood on it, and four of six predictions were never
tested. *The object must be able to die from the top.*

## Calibration — the same instrument on both sides of the record

Every limit was set by running this instrument over the shipped G-code of the printed objects. Hold
and fail are therefore comparable numbers, not numbers from two different measurements.

| object | printed | S3 median reach, worst layer (mm) | S3 tips never tied | S4 overflights (clearance) | S2 worst layer: runs > 10 mm / free mm | S5 ratio | vector |
|---|---|---|---|---|---|---|---|
| LIMIT16_A2L_v1 | 2026-09-04, held | 3.0 | 9 (the tabs) | 0 | 0 / 0 | 12.4 | S3 WARN · S4 PASS |
| OBRTAJ_ENDER_H7 | 2026-09-23, six flat terraces | **17.6** (66 terrace layers, 6–17.6) | **0** | **0** | 203 / 6 488 | 0.343 | **S3 PASS · S4 PASS** |
| RAZMAK_A2L_H4 | 2026-09-23, nested at terrace 1, stopped | **30.7** | see FINDINGS | see FINDINGS | 280 / 20 977 | 0.698 | **S3 FAIL** |
| KRAK_A2L_X1 | 2026-09-24, destroyed | **24.5** (K1: twelve layers 22.6–24.5) | 90 | **809** (6–12 mm, K2 over K1) | 36 / 1 249 | 0.352 | **S4 FAIL · ORDER FAIL** (S3 declared) |
| KRAK_ENDER3V4_X1 | 2026-09-24, destroyed | **24.5** | 92 | **877** (same pattern) | 36 / 1 483 | 0.433 | **S4 FAIL · ORDER FAIL** (S3 declared) |
| PRAG_A2L_X1 / _ENDER_X1 | not printed | 20.7 (unevidenced band) | 88 / 96 | 13 / 7 (own stacking, 1.6–1.7 mm) | 31 / 1 323 | 1.07 / 1.30 | S3 DECLARED · S4 DECLARED · **ORDER PASS** |
| KUKA_A2L_X1 / _ENDER_X1 | not printed | 20.7 | 265 / 236 | 58 / 16 (own stacking) | 62 / 956 | 1.07 / 1.30 | S3 DECLARED · S4 DECLARED · **ORDER PASS** |

What the table settles:

- **S3 separates the record with one statistic.** Every OBRTAJ terrace layer has a median reach at or
  under 17.6 mm; every KRAK K1 layer is at 22.6–24.5; RAZMAK's first terrace is at 30.7. The hold
  limit is 17.6, the fail evidence begins at 22.6, and the band between is refused outside a declared
  zone. PRAG and KUKA sit in that band on purpose (20.7 mm).
- **S2 was falsified.** The earlier reading's central number — 512 free runs longer than 10 mm in
  KRAK's K1 — is real, but OBRTAJ's first terrace layer carries 203 such runs and 6.5 m of free
  thread in one layer, five times KRAK's, and it held. Quantity does not decide. S2 reports.
- **The longest tip does not decide either.** OBRTAJ held a 37.6 mm tip; KRAK failed with none
  longer than 24.6. The shortest tip (OBRTAJ 2.0–3.4, RAZMAK 12.4, KRAK 21.7) is consistent with
  "short tips carry the long ones" but is one comparison, so it is reported, not refused.
- **S4 is KRAK's second mechanism and OBRTAJ has none of it.** 809 passes of the K2 castle legs
  straight over K1's never-tied tips, 6–12 mm below; the ziggurat's steps go inward, nothing ever
  flies over a fringe. The nozzle envelope is capped at 2 mm laterally because every evidenced pass
  lies within 1.5 mm of a tip; the heater block above the cone is deliberately not modelled — it
  would also flag the next-tier walls of the object that held.
- **S5 cannot refuse on this record.** 0.343 held on the Ender (OBRTAJ), 0.433 left the Ender plate
  (KRAK), 0.352 held on the A2L plate (KRAK): the number is per machine and per plate state.
- **S7 and S8 cannot refuse on this record.** OBRTAJ's first terrace layer is 11.8 % carried with
  939 layers above it and held; OBRTAJ has 114 A-B-A-B layers and printed flat. Semir's weave rule
  (every layer must cross the one below, 2026-09-18) stays a generator rule; S8 reports where it is
  broken so the generator can be held to it.

## What is assumed, in one place

- the 12-layer consolidation depth of a pile (one held object);
- the nozzle cone (0.6 mm tip, 0.7 mm/mm, capped at 2 mm laterally) — from the toolhead drawings,
  not measured;
- the 12 mm clearance under which an overflight is refused — 5.0 mm is the evidenced failure and
  nothing above it is evidenced either way;
- the 1.5 mm tie radius and the two-layer tie window;
- 1 mm of closing pass allowed above a declared band.

Each is named in the code beside its number. None of them is evidence, and the next printed object
can move any of them.

## How it runs

    node weft.mjs check FILE.gcode --machine a2l                 # S1, then S2–S8 + ORDER; either refuses
    node weft.mjs check FILE.gcode --machine a2l --zones z.json  # with declared zones [{name,z0,z1,declares?}]
    node weft.mjs build ... --geo G.json --machine a2l --out DIR # writes <name>_gate_layers.json; refuses on S3/S4/ORDER
    node tools/gate_layers_run.mjs FILE.gcode --bead 0.45 --json out.json --per-layer   # the raw instrument
    node tests/gate_layers.test.mjs                              # synthetic HOLD / KRAK / DECLARED objects + the printed LIMIT16

`index.html` loads `core/weft_gate_layers.js` beside `core/weft_gate.js`; **Download G-code (gated)**
now needs both verdicts.

## What the gate still cannot see

How high a given hairpin rises, and when. Whether a corbel of 2.5 mm steps at 22 mm of reach is a
shelf or a hook (PRAG asks at five tip gaps; KUKA at five end conditions, the terrace last on both).
The fan, the bed temperature, the speed — S6 in the earlier plan — which is why every rung on those
objects is printed twice, 180° apart.
