# P0 · Šuma 4×4 v2 — outcomes

Printed: 2026-09-02/03 · Bambu A2L · **Route B** (WEFT's own G-code) · white PLA · textured PEI
Photographed: 2026-09-03, 24 frames — 8 during the print (z ≈ 2 mm and z ≈ 20 mm) and 16 of the finished object.
Gate: `check_gcode.py --bead 0.45 --maxbridge 12` run on this exact file for the **first time** on 2026-09-03,
after the print. 237 z-levels, 1772 extruded paths, 608 837 points checked. **PASS: false · 930 problems.**

> This print was built BEFORE the gate existed. Its job was to answer one question:
> **do the things the gate calls defects show up in the plastic at all?**
> The answer came back split, and the split is the result.

---

## 1. What the compiler predicted, and what happened

| what | where | predicted | what the plastic did |
|---|---|---|---|
| foundation | z = 0 | 16 brims merged where they touch, interstices open, 232 ring-paths in one tour | **Confirmed, and measured: 8 islands, not 1.** The brims merged in pairs along Y into eight figure-8 pads; between pairs the plate stayed bare. Every pad stuck; no lifting, no stringing on layer 1. The piece stood on eight separate feet until the first merge. |
| merge 16 → 8 | z ≈ 12.7 | eight necks weld into one curve each | **Clean.** Photographed mid-print: the two walls become one S-curve, welds continue through the neck, no seam, no doubled wall, no gap. Third independent physical confirmation of the fillet rule. |
| merge 8 → 4 | z ≈ 24.7 | | Clean in the finished object; no knot or blob at any neck. |
| merge 4 → 2 | z ≈ 34.3 | | Clean. |
| merge 2 → 1 | z ≈ 38.4 | one vault | Clean — the object is one connected piece, 16 open bores below, one mass above. |
| hole caps ×21 | z 25.0 – 38.6 | filled Archimedean membrane, largest free span 11.2 mm | **14 of 21 defective. 12 were laid over open air; not one of the remaining 7 has its rim fully on material — the best is 58 %.** See §3. |
| rung-tip crowding | 8 layers at forming necks | "believed to be the weld forming, not a knot" | **Believed correctly.** No knot is visible at any neck in any photograph. |
| unintended overlaps | 16, in 236 layers | threads fusing where they should cross | Not findable in the plastic. 0.07 ‰ of the thread; invisible. |
| top closure | z ≈ 47.2 | single cap | There is no cap above z 38.64 in the emitted file — the bores stay open to the top by design. The README's z 47.2 entry was a mis-grouping, not a missing path. |

**Survived removal: yes. Stands on its own: yes.** One piece, no layer shift, no delamination.

---

## 2. What the gate says, and what the photographs say back

| class | count | where | visible in the plastic? |
|---|---|---|---|
| FLOATING | **0** | — | — |
| DISCONNECTED_FIRST_LAYER | 0 | (8 islands reported, `--maxislands` not set) | eight pads, all stuck |
| LONG_BRIDGE | **864** | role `chord`, z 11.76 – 24.72 only | **as sag, not as failure** |
| CANTILEVER | 54 | role `chord`, z 24.24 – 24.72, runs 3.4 – 9.2 mm | not separable from the above by eye |
| BAD_MEMBRANE → FLOATING / UNANCHORED | **15** | role `cap` | **every single one** |

### The bridges: the rule measures the right thing and refuses at the wrong number
864 runs of contour, arc length **min 12.06 · median 13.92 · p90 19.54 · max 70.67 mm**, worst lateral gap
**min 3.12 · median 4.97 · p90 5.20 · max 5.52 mm**. Every one of them is in the merge band z 11.8–24.7,
where the outer rail steps outboard of the layer below as two lobes become one.

In the photographs these are the long swooping ribbons between the lobes. They are **anchored at both ends,
they printed, and they hold** — but at the longer spans they visibly **droop**, and some of the loose strands
in the interior come from there. So: not a failure, not nothing. A cosmetic sag with a threshold in the wrong
place. `maxbridge = 12` is a guess that refuses geometry an A2L with full part cooling executes cleanly to
about 20 mm at ≤ 5.5 mm of lateral gap. It is also **a global number answering a machine-local question**:
the same span on an Ender with no part fan is a different object. `maxbridge` belongs in `machines.json`,
with an error threshold and a warning band, not as one constant in the checker.

### The membranes: the rule is right, its severity name is wrong, and the bug is real
`BAD_MEMBRANE` sounds like a warning. It is the worst class in the file.

---

## 3. The failure: fourteen cap membranes, twelve of them printed in mid-air

Measured directly from the G-code — for every cap path, what fraction of its **outermost turn** lies on
material printed by the layer below, and how far the nearest point of that turn is from anything:

| z | caps | R_out | outer turn anchored | nearest material under the rim | verdict |
|---|---|---|---|---|---|
| 24.96 | 4 | 9.75 | 57 % | 0.0 mm | anchored, barely |
| 26.16 | 4 | 8.83 | **0 %** | 10.8 – 11.0 mm | **in mid-air** |
| 34.56 | 2 | 12.04 | **29 %** | 0.0 mm | **rim mostly in air** |
| 34.80 | 4 | 7.24 | **0 %** | 11.6 – 13.8 mm | **in mid-air** |
| 35.28 | 2 | 11.20 | **0 %** | 15.6 mm | **in mid-air** |
| 37.92 | 2 | 9.16 | 58 % | 0.0 mm | anchored, barely |
| 38.40 | 2 | 8.65 | **0 %** | 6.2 mm | **in mid-air** |
| 38.64 | 1 | 12.09 | 50 % | 0.0 mm | anchored, barely |

**14 of 21 by this probe, 15 of 21 by the checker** (they differ by one on the 50 %/58 % boundary). Twelve are
outright floating. **No membrane in the object has its outer turn fully on material** — the best is 58 %.

Probing one column, layer by layer, at the cap centre (165.0, 113.0) — nearest extruded material to that point:

```
z 33.60  web     6.40 mm      the hole is dying, its ring is there
z 34.32  chord   6.81 mm
z 34.56  cap     0.15 mm      <- correct cap, lands on the rim
z 34.80  (none) 25.80 mm      the hole is gone; nothing is printed here
z 35.04  (none) 26.62 mm
z 35.28  cap     0.07 mm      <- SECOND cap over the same dead hole, 0.72 mm of air beneath it
z 35.52  (none) 27.71 mm      and nothing above it, ever
```

And at (132.0, 113.0) there is no material within 17–21 mm at **any** layer below — a Ø14.5 mm disc printed
alone in the void, then abandoned.

**In the photographs these are the discs that sit lower than everything around them, wrapped in strings, one
of them sagged into a bowl, and two collapsed into balls of filament.** They are the same object as the five
floating discs of WEFT-01, in a different costume, and they shipped for a plain reason: **`make_suma.mjs` had
no gate.** The checker existed, the builder never called it, and nobody had ever pointed it at this file by hand.

### The three defects behind it, all in nine lines of `suma_geometry.py`

1. **The cap is a circle drawn from `(argmax of the distance transform, r_ins)`.** That pair asserts *this hole
   is a disc of radius r_ins*. For a round hole it is true, and those caps are the ones that landed. For a
   crescent, a peanut or an isthmus it is false everywhere except at one tangent point, and the spiral's outer
   turn hangs over air for most of its circumference.
2. **`CAPPED` is keyed on the hole centre rounded to 0.1 mm.** The centre drifts more than that between layers,
   so one hole is capped again and again as it moves — each repeat over the void the first cap left behind.
   That is the pair at z 34.56 / 35.28 above.
3. **A hole that is *born* is capped as readily as one that dies.** The morphological opening/closing that
   rounds the cusps creates transient holes from one layer to the next. Line 80 of the file already states the
   law — *a hole may die going up, but must never be born in the air* — and the cap rule does not apply it.

### The one lesson, eighth instance
*A global number may never answer a local question.* `(centre, r_ins)` is a global summary of a hole; the cap
was drawn from the summary instead of from the hole's own boundary and its own support. The fix is the same
shape as every previous one: **generate the membrane from the hole's actual rim** — successive inward offsets
of the hole region, one bead apart, linked into a single path — so the outermost turn lies half a bead inside
the real rim whatever shape that rim has, and **cap only a hole that existed on the layer below**, tracked by
region overlap rather than by a rounded coordinate.

---

## 4. Smaller findings

- **The packaged header lies.** The file carries the harvested D5 header: `model printing time: 1d 1h 26m 54s`,
  `total filament weight: 185.94 g`, `total layer number: 583`, `max_z_height: 139.88`. None of it describes
  this object. The printer's estimate on the screen was therefore wrong. The harvested block must have its
  statistics stripped or rewritten at package time.
- **Stringing** across the open interior is significant, in every interior photograph. Every travel in a lattice
  crosses air; there is no interior surface to hide a hop on. Not yet quantified.
- **The weave itself is the best evidence in the set.** The side views show perfectly regular chord bands and
  web rungs, weld nodes in straight vertical columns, arches carried without droop. The wall reads as cloth.
  Nothing in the weaving grammar is in question.

---

## 5. Verdict

The gate earns its place, and it is mis-calibrated in **opposite directions** on its two rules:

- the rule that fired **864 times** refuses geometry the machine prints (with a cosmetic sag) — its threshold
  is a guess and belongs to the machine, not to the checker;
- the rule that fired **12 times** found every real defect in the object, and calls them "bad membranes".

So the question this print existed to answer has a two-part answer, and the second part is the one that matters:
**the compiler is still capable of emitting a path with nothing under it, and this object is the physical proof.**
Not a near-miss caught in review — printed, photographed, hanging in the air.

Next, in order:
1. `check_gcode.py`: BAD_MEMBRANE whose outer turn misses the material below is FLOATING. Rename and re-rank.
2. `suma_geometry.py`: rim-following cap, inherited-hole-only, overlap-tracked. Then re-run the gate on 2×2 and 4×4.
3. `machines.json`: `maxbridge` per machine, with the A2L's measured evidence (20 mm clean, ≤ 5.5 mm gap, n = 864).
4. Strip the harvested header's statistics at package time.


---

## 6. What was changed on 2026-09-03, because of this print

Three fixes, all made and verified before this file was written.

**1. `make_suma.mjs` now has a gate.** It was the only builder without one. The G-code it writes goes straight to
`check_gcode.py`; if the gate refuses, the output is deleted and the process exits non-zero. `--maxislands`
defaults to 1, so the Šuma foundation's several feet have to be *declared* on the command line rather than
discovered afterwards in a photograph.

**2. `check_gcode.py` now judges a membrane by its rim, and calls a flying disc what it is.**
The spiral law has two halves — turns a bead apart, *and* the outermost turn on the material below — and only
the first was enforced. The anchoring test was `sup.any()`: a disc that grazes anything anywhere passed. Now a
membrane with no supported point at all is **FLOATING**, and one whose outermost turn is less than `--minanchor`
(default 0.5) supported is **UNANCHORED_MEMBRANE**. Re-run on this file it finds 12 FLOATING and 3 UNANCHORED
where the old rule found 12 soft "bad membranes". Regression: the bad-floating fixture still fails, V1 Vrtlog
still passes with 0, P2b Penjač A2L still passes with 0.

**3. `suma_geometry.py` now generates the membrane from the hole's own rim.**
`cap_path()` takes the hole region, grows it by `w/2 + 0.5` so its rim overlaps the wall, and lays concentric
inward offsets of *that* shape one bead pitch apart, linked outer-to-inner into one continuous path, finished
with a single stroke across whatever core is left. It works for a crescent or a peanut because it never assumes
the hole is a disc. On top of it: a hole is capped **only if it existed on the layer below** (`open_below ≥ 0.5`),
which by itself kills both the repeat caps and the born-in-solid caps; and the anchored fraction of the outer
turn is **measured against the wall band of the layer below** before the cap is accepted, so the generator now
applies the same test the gate does rather than trusting a summary.

It took three tries to get the membrane's outer turn in the right place, and the sequence is the lesson:

| attempt | where the first turn was put | anchored (2×2) |
|---|---|---|
| grow this layer's hole by `w/2 + 0.5` | 2.8 mm **outside** the centreline — past the outer rail | 0.82 by the generator's own optimistic band test; the gate failed 3 of 9 |
| take `w/2` **inside** this layer's own rim | inside the rail — a shrinking hole is always smaller than the one below it | **0.00**, refused |
| half a pitch inside the **void below** (previous hole eroded by `w/2`) | on the rail that is actually printed | **0.99** |

The first two are the same mistake in mirror image, and naming it is worth more than the fix: *this layer cannot
say where material is. Only the layer below can.* Every earlier WEFT failure was a global number answering a
local question; this one was a **local number answering a question that belonged to a different layer.**

One more thing fell out of it. A courtyard is born *bounded* at the merge that encloses it; one layer earlier it
is still a channel open at both ends, and a membrane over it would hang off those ends. The generator now
declines to cap in that state and does not fill either — it leaves the hole, lets the wall ring it once more, and
caps it on the next layer, where a closed rail exists to land on. The 2×2's single cap moved from z 24.84 to
25.08 and went from unanchorable to 99 % anchored.

Result on the 2×2: **one cap, 0.989 anchored, longest link jump 0.47 mm, 0 refused, 37 holes born inside solid
and filled without a cap.** Those 37 are what the old rule was happy to hang in the air.

Still open: the 4×4 has not been rebuilt and re-gated with the final rule (its first rebuild, with the wrong
outer-turn placement, already had **0 FLOATING** against the printed object's 12); `maxbridge` is still a
constant in the checker rather than a machine property; the harvested header still carries the D5's statistics.
