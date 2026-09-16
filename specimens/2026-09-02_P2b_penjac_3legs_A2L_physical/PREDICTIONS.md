# P2b Penjač · 3 legs · A2L — predictions, registered 2026-09-03 while it is on the plate

**This is one of the first two objects WEFT has built that the gate approved before it was printed.**
Everything physical we have so far comes from geometry made before the gate existed. So the question this
print answers is not "is it pretty" — it is **does gate-clean mean clean in plastic.**

## What is actually in the file (measured from the G-code, not from the README)
| | |
|---|---|
| size | **91 × 82.6 × 240 mm** — 240 is the HEIGHT, and it is the tallest thing WEFT has made |
| paths | 1501 · 220.3 m of thread · 20 851 welds · 2.45 h kinematic |
| gate | **PASS, 0 problems** over 303 558 checked points, first layer 1 island |
| overlaps | **0** unintended |
| membranes | one, at z 239.8 (the head closing) — anchoring **1.00**, turn spacing 0.39 mm |
| travel | 15.25 m over 1258 moves = **6.9 % of the thread length**; 544 retractions of 0.8 mm at 30 mm/s |
| bead | 0.45 / 0.24 — **measured**, the only calibrated pair WEFT owns |

*(the README's "240 × 99.5 × 91.1" is wrong in both order and one value; the report says [91, 82.6, 240])*

## Predictions
1. **Nothing hangs in air.** Zero paths over unsupported space, anywhere, at any height. If any part of this
   object is found floating, the gate is wrong and that single fact outweighs everything else here.
2. **The top cap is a clean, complete disc.** It measured 1.00 anchored — every point of its outer turn on
   material. **Whether it has a slit at its centre is the discriminating test:** every one of the Šuma's 21
   membranes photographed with a slit, and if this one does too *despite* perfect anchoring, the slit is
   kinematic — the machine cannot execute turns inside a 2 mm circle — and not a geometry fault at all.
3. **Visibly less stringing than the Šuma.** Travel per metre of thread is 6.9 % against the Šuma's 15.4 %,
   with the same retraction. Expect strands, but roughly half as many.
4. **The three legs merge without a blob at the shoulder.** The arm-thickness fade was added specifically
   because a retracted arm used to leave a 9.9 mm shoulder that vanished in one layer.
5. **The brims are connected with openings between them**, one island, and they hold.
6. At 240 mm, **watch the top third for ringing and wobble** — that is a machine limit, not a compiler one,
   and it has never been tested at this height.

## Photograph, in this order
whole piece against something for scale · the first layer from underneath · each leg-merge in close-up ·
**the top cap from directly above, close** · the wall weave in raking light · anything that went wrong.

## Verdict
- gate-clean meant clean in plastic: ___
- top cap: complete / slit at centre / ragged rim: ___
- stringing vs the Šuma: ___
- what I would change: ___

---

## Interim, 2026-09-03, mid-print (photographs from the machine)

Printed in two colours — white feet, green body — which makes the foot-to-leg transition legible.

**Prediction 5 confirmed, and it is the one Semir asked for on 2026-09-02:** three separate circular
pads joined by thin ribs, bare plate between them. *"Naši brimovi na prvom lejeru budu spojeni minimalno
tako da među njima imamo rupe."* It is in plastic, it held, and the legs pulled out of it cleanly.

**Prediction 4 confirmed:** the three legs merge into the trunk with no blob at the shoulder. The
thickness fade added after the Šuma is doing its job — the merge is a smooth waist, not a lump.

**Prediction 3 confirmed:** almost no stringing is visible, against the Vrtlog's heavy bundles.
6.9 % travel vs 13.2 % of thread length, same retraction, same day. The travel figure predicts stringing
and the two objects bracket it.

**The wall:** dense, regular horizontal banding with the weld tabs as an even row of bumps along each
rim; successive layers are fused, no gaps between them. This is the A2L at the only bead WEFT has ever
measured (0.45 / 0.24) and it looks like it.

**Still unanswered:** the top cap at z 239.8 — anchoring 1.00, and whether it has a slit at its centre
is the test that separates a geometry fault from a kinematic one.
