# The next challenge, set on 2026-09-03 after the Šuma 4×4 photographs

## What today actually taught

Eight failures in three days, and every one of them has now been the same sentence:

> **A global number may never answer a local question.**

Today added a twist that is worth its own line, because it is what let twelve membranes fly:

> **This layer cannot say where material is. Only the layer below can.**

The membrane's first turn was placed twice from things this layer knows — the hole's inscribed circle,
then the hole's own rim — and both were wrong, in mirror image. It came right only when it was placed
from the void *below*. The wall has the same property and we have not looked: `chordLayer` decides
where its rails go from this layer's contour, and the gate then measures whether that lands on
anything. 864 times on the Šuma it did not, by up to 5.5 mm.

And underneath both, the thing that actually shipped the defect:

> **The generator believed 0.82 where the gate measured failure — and the generator was the one
> holding the pen.**

Nothing catches a wrong belief except an independent measurement, and we only ran one by hand, after
the object was already in plastic.

## The challenge

**Make the generator's belief and the gate's measurement agree by construction, then prove it on an
object built entirely out of the things that have broken us.**

Three parts, in order. Each has a number that decides it, not an opinion.

### 1. One support primitive, used by everything
Every generator that decides where to put a path — wall rails, membranes, foundation ribs, ribbons —
asks the same function the same question:

```
supported_offset(region_to_fill, material_below, pitch) -> path, anchored_fraction
```

`material_below` is the *rasterised extruded centrelines of the previous layer*, i.e. exactly what
`check_gcode.py` builds. Not a mask of solid. Not an idealised band of width w. The same object the
gate uses, computed once per layer and handed down.
**Done when:** no generator computes support from its own layer's geometry anywhere in the codebase.

### 2. Belief must equal measurement, or nothing ships
Every emitted path carries the anchored fraction its generator believed. The gate reports the
fraction it measured. The builder refuses if they differ by more than 0.10 — *even when both pass*.
A disagreement is not a warning, it is the failure mode itself: it means one of the two is modelling
a machine that does not exist.
**Done when:** `weft.py` refuses a build on belief/measurement divergence, and the Šuma 2×2 passes it.

**Built the same afternoon, and it worked immediately — against us.** `check_gcode.py` now records the
anchoring it measured for *every* membrane, pass or fail, and `make_suma.mjs` compares it with the number
the generator declared, refusing on a gap over 0.10. First run on the 2×2:

| | anchoring of the membrane's outer turn |
|---|---|
| what `suma_geometry.py` believed | **0.989** |
| what `check_gcode.py` measured | **0.754** |

Both pass their own thresholds; the build is refused anyway, and rightly. The generator models the support
below as an idealised band 5 mm wide around the previous contour. The machine does not lay a 5 mm band — it
lays two rails, rungs between them and tabs at the nodes, and a quarter of the membrane's rim falls in the
gaps. **Level 2 cannot know where the rails go, because level 3 draws them.** That is not a tuning error; it
is the reason Part 1 exists, and 0.235 is its size.

Two smaller things fell out of building the instrument, both of them the same mistake in my own new code:
- the first "outermost turn" test took every point within two beads of the maximum *radius* — which assumes
  the membrane is a circle. On the clover-shaped courtyard it selected four corners and reported 0.50. It
  now takes the path's first closed loop, which needs no assumption about shape.
- the turn-spacing metric measured distances between *sampled points*, so a path the emitter had thinned to
  2 mm segments reported 0.83 mm turns where the rings were laid 0.38 mm apart. It densifies first now.
  Separately, the commanded pitch had to drop from 0.82·bead to 0.55·bead: the rings are marching-squares
  contours on a 0.2 mm grid, so the spacing achieved is up to one grid cell wider than the one asked for.

### 3. Rešeto — the object that is nothing but the failures
For the **Ender** (220 × 220 × 235), ~90 × 90 × 110 mm, under three hours.
A body whose entire content is hole-death events, one of each shape that has ever broken the cap rule,
each at its own height so each can be photographed and judged separately:

| z | hole shape | why it is there |
|---|---|---|
| ~20 | circle | the shape the old rule was right about — the control |
| ~34 | peanut | the inscribed circle sits in the waist; the rim is 20 mm away at the ends |
| ~48 | crescent | the inscribed circle touches the rim at one point only |
| ~62 | isthmus (long, thin) | dies along its length, not at a point |
| ~76 | annulus | has no centre at all |

Between them, the three weave grammars that have **never been printed**: `diagonal`, `sine`, `eight`.
The crown closes on a membrane, so the last thing the machine does is the thing that failed.

**Acceptance, decided before it is built:**
- gate passes with **0 problems**;
- every membrane's anchored fraction ≥ **0.90**, generator *and* gate, agreeing within 0.10;
- travel budget stated in advance and measured in the emitted file: hops over open air, total hop
  length, and the longest single hop — because stringing is the most visible defect in every
  photograph so far and has never once been quantified.

**And then it is printed.** Nothing WEFT has made *since the gate existed* has been printed. V1 Vrtlog
and P2b Penjač are both gate-clean and both still on disk. Rešeto is not finished when it passes the
gate; it is finished when its photographs are next to this file.

## What this challenge deliberately does not do
- It does not touch `maxbridge`. The Šuma gave the first real measurement (A2L, full cooling: 20 mm of
  arc at ≤ 5.5 mm lateral gap prints with a visible sag and holds; 70 mm is the longest observed).
  That number belongs in `machines.json` per machine, and the Ender's is **unknown** — Rešeto must not
  quietly depend on it.
- It does not use an uncalibrated bead. The Ender's bead is still `ASSUMED 0.42`. The C1 plate is
  printed and waiting for five caliper readings. Rešeto is built after that, not before.

## The debt this creates
`sieve_geometry.py` would be the **third** copy of the same layer engine (`suma_geometry.py`,
`vase_geometry.py`, `climber_geometry.py` already share it by copy-paste). Part 1 above is the excuse
to factor it out properly instead — one engine, four bodies. If Rešeto ships as a fourth copy, that is
a failure of this challenge, not a shortcut in it.
