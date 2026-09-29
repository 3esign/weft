# Independent VEZ review

Reviewed 2026-09-26. Read-only review of initial `generate-vez.mjs`, VEZ_ENDER_X1 design/report/G-code header, and inherited geometry/build/emitter. No tests run and no generator changes made by reviewer.

## Findings in V1

1. **Same-layer duplicate extrusion is material.** Each sector's pretie travels from RB to the previous frontier along its first radial leg and returns along its last radial leg. The subsequent tooth traversal prints those same XY segments again at the same Z. The first full RB lap is also followed by another partial lap through the intertooth base arcs, plus each sector's backward root arc. The built Ender report independently flags `unintendedOverlaps: 7365`. A support pass does not resolve the buildup/nozzle-contact risk.

2. **The holds duplicate the outer tip arcs.** In j=60 and j=61, `prev == now`; pretie and teeth both print the same outer arcs at the same layer height. This concentrates extra material at the vulnerable free edge.

3. **A closed flag changes route order.** `weft_core.js` rotates a closed path's starting point toward the previous nozzle position. It can therefore rotate a nominally ordered root/tie/tooth path away from its intended first operation. Open paths are only reversed by endpoint distance; a full teeth traversal whose first and last points are identical will not reverse on an endpoint-distance tie.

4. **The support tolerance masks nominally unsupported growth.** `allow=0.6` is at least every design advance (.4/.5/.6 mm), while Ender's bead is .42 mm. S2 `free_m=0` means no free filament under that discrete tolerance model; it does not establish physical contact beneath the new frontier. The explicit <=4.4 mm growth excursion remains the relevant design claim, pending printing.

5. **Travel hop is 0.4 mm, not 0.6 mm.** Emitter constants are RETRACT=.8, HOP=.4. A crossSpec transition or travel > max(6,w+2*overshoot+2) triggers it. Separate pretie arcs can otherwise have short unhopped transitions between sectors. `row`/`col` become specimen metadata solely to force those transitions, so if used, record why they do not denote actual separate specimens. First-layer connected components are measured from geometry, not this metadata.

## Concrete correction recommended to root

- Print twelve separate old-frontier arc paths before the growing teeth; each starts and ends on the previous layer's tip material. Do not extrude the connecting radial legs.
- Print one root-connected teeth traversal without the initial full root ring. The roots/intertooth arcs continue on existing wall material.
- Mark those paths open to preserve operation grouping; force protected travel for transitions that can cross a fresh edge, and document the actual .4 mm hop.
- Replace two duplicate hold layers with one final tie-only layer at full reach. This ties the final frontier without reprinting teeth at the same Z.
- Regenerate reports and inspect overlap counts and exact G-code after changes. Do not claim absence of physical fringe or guarantee print completion.

## Metadata and dimensional review

- Sector pairing, six reach/gap recipes, four teeth per sector, and totals 24/30/36 mm agree with the generator.
- The root seat radius is inherited R+1.5+.7=57.2 mm. The original KUKA's extra .55 mm terrace offset is not used by VEZ; the new explicit RB is intentional.
- Ender dimensions and bead-edge margin in initial design agree with the built report within rounding: about 185.8 x 174.8 x 18.4 mm, minimum 17.1 mm bead-edge margin.
- `kinematic_h` assumes a blanket 30 mm/s and `routeA_estimate_h` uses an inherited empirical factor. Neither is a reliable actual print-time prediction for mostly 18 mm/s raw paths.
- Machine width assumptions are explicitly retained. PhysicalStatus=NOT PRINTED is correct.

## Honest verdict

Verified: implementation ordering rules, path duplication causes, actual emitted report values, inherited radius and machine metadata.

Inferred: duplicate buildup and short travel can increase nozzle-contact risk; no thermomechanical simulator or physical print was performed.

Not inspected: new photographs, full machine header qualification, actual printer state, final revised output. Root and other agents own those checks.

Tool note: two guessed emitter filenames did not exist; resolved through a bounded core directory listing to `weft_core.js` and `weft_build.mjs`.

## V2 re-review

Re-read revised adapter and VEZ_ENDER_X2 report after regeneration. The twelve pretie arcs are now separate open paths placed before the one growing teeth traversal. The root lap and radial replay are removed. The growing traversal has identical rounded endpoints and is open, so the emitter's nearest-end rule cannot reverse it. Either direction of a pretie is valid because both endpoints land on previous tips. The final 61st terrace layer contains only twelve ties.

The revised report counts 121 overlaps: one at the inherited closed seat and two per growing teeth traversal (60 traversals). This count is consistent with adjacency at the route seam; it is not evidence of remaining 500+ mm radial replay. Independent interval-coverage tests were written in `tests/vez-regression.test.mjs` to confirm this directly against the saved geometry and the V1 positive control. At this writing they have not been run; the test lane belongs to another agent.

Each raw path's row/column key differs from the next, and the emitter retains the prior raw key through intermediate contour paths. This forces its retract/hop branch for the inter-pretie transfers and transitions from tie to growth. The first growth layer starts near the already-supported root and has no preties. Root is preparing a separate exact-pattern final G-code hop increase to 1.2 mm; that finalization was not part of the reviewed core emitter and must be verified after applying.

No additional blocking geometry defect found in this read. Physical behavior remains unqualified; in particular the pretie is attached to prior cantilever tips, not directly to new ground supports.