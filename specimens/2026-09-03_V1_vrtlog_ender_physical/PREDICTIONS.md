# V1 Vrtlog · Ender-3 V4 — predictions, registered 2026-09-03 while it is on the plate

The other of the first two gate-approved objects. It carries a caveat the Penjač does not:
**the Ender's bead has never been measured.** Everything here is built on an assumed 0.42 / 0.20.

## What is actually in the file (measured from the G-code, not from the README)
| | |
|---|---|
| size | **90 × 86.9 × 130.4 mm** — 130.4 is the HEIGHT (the README's "130 × 96 × 94" is wrong) |
| paths | 1272 · 225.4 m of thread · 23 049 welds · 2.5 h kinematic |
| gate | **PASS, 0 problems** over 271 504 checked points, first layer 1 island |
| overlaps | **0** unintended |
| membranes | three — z 49.6 (hole death), z 92.0 (hole), z 129.8 (the top) |
| membrane anchoring | **0.724 · 0.667 · 0.738** — measured by the gate, and these are the weak numbers |
| travel | 29.72 m over 1171 moves = **13.2 % of the thread length**; 803 retractions of 0.8 mm |
| bead | 0.42 / 0.20 — **ASSUMED. Never calibrated. This is the largest unknown in the object.** |

Three weave grammars appear here that have **never been printed**: `diagonal`, `sine`, `eight`.

## Predictions
1. **Each of the three membranes shows a defect at its rim.** They are only two-thirds to three-quarters
   anchored, which means a quarter to a third of each outer turn lands on nothing. Expect a drooping or loose
   arc on one side of each disc, worst at z 92 (0.667).
   **This is the number that decides the gate's `--minanchor` threshold.** If they come out clean, 0.5 is a
   fair floor and we keep it. If they are ragged, the floor goes to 0.9 and this object gets rebuilt.
2. **Stringing comparable to the Šuma** — 13.2 % travel against the Šuma's 15.4 %, and the interior is open,
   so the strands will be visible straight through the eyes.
3. **The bead is measurable from the print itself.** Photograph the wall in raking light: if the assumed 0.42
   is too small the bands close up and the weave looks solid; if too large, gaps open between chord bands.
   That reading is worth as much as the C1 plate.
4. **The three untested grammars either work or they do not**, and this is the only evidence that will exist.
   Photograph each band separately — they change with height, so a single side view will not do.
5. First layer is one island with five openings; on an uncalibrated bead **the first layer is the risk**.
   If it lifts or strings badly, stop and say so — that is the bead, not the geometry.

## Photograph, in this order
whole piece · first layer from underneath · **each of the three membranes from above, close** ·
each weave band separately in raking light · the interior through the eyes (stringing) · anything that failed.

## Verdict
- membranes at 0.67–0.74 anchoring: acceptable / ragged: ___
- `--minanchor` floor should be: ___
- the three new grammars: ___
- apparent bead vs the assumed 0.42: ___

---

## Interim, 2026-09-03, mid-print (photographs from the machine)

**A wrong conclusion, caught by measuring first.** The wall photographs as open netting — individual
threads separated by visible gaps, in places more hole than thread — and against the Šuma's cloth-like
weave that reads immediately as under-extrusion, i.e. a real bead smaller than the assumed 0.42.
It is not. Measured from the emitted file:

| role | commanded E/mm | implied bead width at 0.20 mm layers |
|---|---|---|
| nominal 0.42 × 0.20 stadium | 0.03135 | 0.420 |
| cap | 0.03174 | 0.425 |
| chord | 0.03352 | **0.446** |
| web | 0.03496 | **0.463** |

The file commands **6–11 % MORE** material than the nominal bead, not less. And the rung spacing in the
web layers, measured band by band:

| z band | web layers | rungs/layer | rung spacing |
|---|---|---|---|
| 0–20 | 49 | 53 | 5.85 mm |
| 20–40 | 50 | 63 | 3.13 mm |
| 40–60 | 50 | 79 | 7.77 mm |
| 60–80 | 50 | 41 | 3.75 mm |
| 80–100 | 50 | 23 | 7.21 mm |
| 100–120 | 50 | 31 | 6.57 mm |
| 120–131 | 26 | 11 | 2.97 mm |

Rungs 3 to 8 mm apart with a 0.45 mm thread: **the web bands are 90 %+ air by design.** The netting in
the photographs is the drawing, not a fault. The bands that photograph solid are the chord-dominated
ones, and they are solid. Both this object and the Penjač behave the same way band by band, on two
different machines. **No under-extrusion claim survives this measurement, and the bead question stays
open until the C1 caliper readings — the print cannot answer it.**

**Confirmed:** stringing is heavy, exactly as the 13.2 % travel figure predicted — repeated bundles of
five to eight taut strands spanning the openings, not sagged bridges but travel strings pulled between
anchors. The three weave grammars are visibly distinct: an open diamond lattice, a chevron, and a dense
vertical-striation wall. First physical evidence for `diagonal`, `sine` and `eight`.

**Still unanswered:** no membrane has been photographed clearly. The three at z 49.6 / 92.0 / 129.8 are
the point of the object.
