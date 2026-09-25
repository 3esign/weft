# KRAK_ENDER3V4_X1 — five ways to hold a shelf in the air

**Print `KRAK_ENDER3V4_X1.gcode` from this folder.**

## Why this object exists

DOMET printed on the Ender on 2026-09-24 and finished. Its terraces are **not flat**:
every skirt droops, and in the photographs the hairpin tips read as individual hanging
loops. The 2026-09-19 ziggurat, whose terrace layers repeat every second layer so that
each path is laid six times onto itself, came out as a **stiff palisade** instead. The
2026-09-23 finding called that repetition a defect. The printed evidence says it is what
made the ziggurat stiff, and KRAK treats it as the control rather than the fault.

DOMET also carries a flaw of experiment design that this object corrects. Its reach
ladder runs around the azimuth, and so does the part-cooling airflow, so a break at a
given bearing cannot be told apart from a break at a given reach. **Here every rung is
printed twice, 180 degrees apart.** The support gate is purely geometric and cannot see
the fan, so the two copies of a rung score identically in the tables below — the pairing
exists for the physical object. A rung that comes out different from its twin is telling
you about the machine, not about the design.

## Three ladders, ten sectors of 36 degrees, sector s paired with sector s+5

### K1 — tooth shape, all five at 24 mm, heroic entry

Layer 0 of this terrace is a full-length cantilever, at a reach the record brackets as
near the limit: the ziggurat terrace that stayed flat had a maximum free reach of
25.3 mm, and the A2L terrace that went to nests had a minimum of 20.1 mm.

| shape | what it is |
|---|---|
| `plain` | the 2026-09-19 triangle wave, two phases alternating, each laid six times onto itself — the control and the current champion |
| `tiprail` | the same wave, plus a thread that runs back across the sector at the radius the layer below reached. It lands on that layer's tips and on the way it ties every leg of the layer just laid, so a row of independent cantilevers becomes one ring beam. The rail itself never bridges more than one tooth pitch |
| `truss` | the outbound leg zigzags between the outbound line and the tooth's midline, so the pair is a plane truss instead of two parallel wires |
| `splay` | the same wave with a tooth spanning two cells at the base, so the tip is held by a base twice as wide and consecutive layers cross far more often |
| `castle` | radial legs and an arc across the top — the shape that stacks exactly when the reach grows, which is what K2 and K3 need, and which has no diagonal bracing at all, which is what K1 punishes |

The support gate's count of unsupported findings at the evidenced 16.2 mm ceiling:

| shape | sector s | sector s+5 | total |
|---|---|---|---|
| `splay` | 4 | 4 | 8 |
| `truss` | 10 | 10 | 20 |
| `tiprail` | 31 | 31 | 62 |
| `plain` | 47 | 47 | 94 |
| `castle` | 85 | 85 | 170 |

So the gate's ranking at 24 mm, best first: `splay` (4) < `truss` (10) < `tiprail` (31) < `plain` (47) < `castle` (85).

`castle` is the worst shape here and the only shape that works on K2 and K3. That is not
a contradiction: on a heroic terrace its radial legs have nothing to brace against, and
on a corbelled terrace those same radial legs are exactly what lets each layer lie on the
one below.

This is a count of how much thread is hanging at the moment it is laid. It is not a
stiffness measurement and it does not know that a truss is a truss. **The print decides.**

### K2 — corbel step, five advances, all reaching 40 mm

Every sector uses the castellated tooth and grows its reach by a fixed advance per layer.
Only the advance differs: **1.5, 3.0, 4.5, 6.0, 9.0 mm**.

Gate findings: 1.5, 3.0, 4.5 and 6.0 mm all give **zero**. 9.0 mm gives 16 per copy.
Identical on both machines. Geometrically the step is free up to 6 mm and has failed by 9.
The print says where between those the material gives up — and it will give up earlier
than the geometry does.

### K3 — corbel reach ladder, 20 / 27 / 34 / 41 / 48 mm, at a 2.5 mm step

**Zero gate findings anywhere, out to 48 mm.** Nothing hangs further than 2.5 mm from the
layer below at any point, at any reach.

This is the honest answer to "how do we reach further": **stop cantilevering.** A corbel
reaches 48 mm for under 5 mm of height and the gate has nothing at all to say about it.
Whether the material agrees is the question this terrace asks, and it is the most
important question on the object.

## Reading the object

Find a sector by its fringe. On K3 the shortest fringe is the 20 mm rung and they ascend.
On K1 and K2 every sector reaches the same distance, so the rungs are told apart by
texture. The test is always the same: **does a rung look like its own copy 180 degrees
away?** If not, that difference belongs to the machine.

`KRAK_ENDER3V4_X1_plan.svg` in this folder draws the ten sectors with their method names.

## Build figures

| | |
|---|---|
| machine | Creality Ender-3 V4 |
| support gate, declared ceiling | **PASS** — 0 problems over 504,846 points / 157 layers |
| first-layer audit | **PASS** — 1 island, preview Z equals model Z |
| gate at the evidenced 16.2 mm | 386 findings, **0 outside the declared zones** |
| package re-gate | n/a — plain G-code machine |
| Z levels | 156 |
| max Z | 31.2 mm |
| thread path | 281 m |
| filament | 9,115.76 mm ≈ **27.63 g** |
| estimated time | 5 h 24 m 12 s (kinematic estimate, not the printer's own) |

Thread path and filament are two measurements of the same run: the thread path is the
distance the nozzle travels while extruding, the filament figure is the length of 1.75 mm
stock consumed. One is drawn into the other, so the thread path is always larger.
