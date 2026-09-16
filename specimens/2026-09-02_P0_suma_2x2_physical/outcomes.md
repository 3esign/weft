# P0 Šuma 2×2 — outcomes (printed 2026-09-02, photographed 12:04–12:45)

## The headline: the capability is real
The object printed to completion. **Every topology event in the plan happened in plastic:** one foundation slab,
a courtyard ring and an outline rising off it, the split into four columns, the 4→2 merge, the 2→1 merge into a
clover, and the courtyard closing near the top. The merged body is one continuous piece; the necks are welded, not
touching. **CORRECTION (2026-09-02, from Semir's exported .gcode.3mf): this was printed on ROUTE A** — the STL through
Bambu Studio, 250 layers at 0.20 mm, 11.73 m / 35.55 g, Studio estimate 6h 14m 49s, and Studio added its own
5 mm auto-brim on top of the built-in foundation. **Route B has not been printed yet.**

| photo (EXIF) | what it shows |
|---|---|
| 01 · 12:04:52 | whole object in sunlight: clover top, four columns below, foundation edge |
| 02 · 12:05:42 | the merge zone: columns and the joined body, welds legible |
| 03 · 12:05:52 | wall weave detail + a small gap through the wall (~5 × 12 mm) |
| 04 · 12:06:33 | inside, looking at the courtyard closure |
| 05 · 12:45:08 | top view: four column bores + the central closure |
| 06 · 12:45:13 | courtyard closure detail: loose loops and a knot |
| 07 · 12:45:27 | wall weave detail: chord bands vs web bands, tabs on the rim |

## What is good
- **Weave quality**: the wall reads as woven cloth — alternating chord and web bands, node bumps regular along
  the rim, no layer shift, no visible stringing between bands.
- **Merges**: at both necks the two walls become one curve; no seam, no doubled wall, no gap. The fillet rule
  (ρ = 4.25 mm) held — nowhere does the wall cross itself at a neck.
- **Foundation → columns**: the slab printed and the columns pulled out of it as designed.
- **Bores**: the four column interiors are clean circles from above; weld columns look continuous through the splits.

## What failed: the courtyard closure (photos 04, 05, 06)
A tangle of loose loops and a knot where the hole died. **This is the D5 crown failure again, in miniature, at a
hole-death event** — exactly the case the 2026-09-01 theory predicted would be the same problem.

Measured from the geometry file: the courtyard ring shrinks 7.9 → 6.3 → 5.1 mm equivalent radius and then
**vanishes between z = 52.8 and z = 53.8 with no closure**. At r = 5.1 the wall is still 5 mm wide with 1 mm tabs,
so the inner rung tips reach to 1.6 mm from the axis: eight rungs crowd into a 3 mm circle. The overlap detector
did not flag it — centerline distance there is 3.2 mm, far above one bead — but with real bead spread and fillets
that zone is a knot, and the last ring stands as a free stub with nothing above it.

Three separate defects, all fixable:
1. **No minimum hole radius.** A hole must not shrink below `w/2 + e + ρ_min ≈ 7.75 mm`. Below that the wall
   cannot turn around it.
2. **No hole cap.** A hole that must die needs a deliberate filled closure (the dome-cap spiral), spanning ≤ maxBridge.
3. **The overlap check is blind to tab crowding.** It compares centerline points; it must also measure the minimum
   distance between *rung/tab tips* in a layer. A zone where many tips converge is a knot even with no centerline overlap.

## Second defect: a gap through the wall (photo 03)
A roughly 5 × 12 mm hole in the wall where several rungs are missing across two or three bands. Cause not yet
determined — candidates: `rungTooTight` skipping rungs where curvature is high (by design, but here it left a hole),
a local under-extrusion, or a travel/retract event. Needs the G-code checked at that height before claiming a cause.

## Not measured
Print duration, actual filament used, mass, stiffness, whether the necks survive being pulled apart. The tangle
was not cut out for inspection.

## Verdict
The compiler's merge/split machinery is proven in plastic on the first attempt. The remaining failure is a
**death event without a closure rule** — the same missing rule as the dome crown, now with a second independent
piece of physical evidence and exact numbers for where it starts.
