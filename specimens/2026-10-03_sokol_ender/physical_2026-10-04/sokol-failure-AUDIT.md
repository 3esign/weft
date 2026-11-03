# SOKOL V2c Ender — bounded independent audit, 2026-10-04

Private local evidence. No model rebuilt, gate weakened, or original file edited. User identifies the latest Ender print as failed. The photographs are not calibrated to Z and the executed file hash is not bound; this audit verifies the delivered candidate, not which bytes actually ran.

## Strong finding: a pathological merge layer exists in the delivered bytes

Candidate: `!Projekti/weft/ZA_STAMPU/CREALITY_Ender3V4/SOKOL_V2c/SOKOL_V2_ENDER.gcode`, SHA-256 `d7b09b685db757da401bf3d7b136b93aa00b9457287afc1120c155bcf4818832` (matches the delivery record).

| Commanded Z | Zero-based geometry k | Extrusion paths | Extruded length | Final G-code segments | Extrusion time from commanded feeds |
|---|---:|---:|---:|---:|---:|
| 121.2 mm | 605 | 3 | 2,788.650 mm | 6,591 | 154.925 s |
| **121.4 mm** | **606** | **1** | **51,195.359 mm** | **120,192** | **2,844.187 s / 47.403 min** |
| 121.6 mm | 607 | 1 | 3,538.1 mm | 1,819 | 70.8 s |

The 121.4 mm path occupies XY `[70.305,74.267]`–`[121.930,145.524]` in bed coordinates and commands 1,605.207 mm of filament. Its extrusion is 18.36 times the previous layer's length. The section's source area is 2,541.321 mm². Nominal bead-width×path-length area is 8.461 times that area; at declared 1.75 mm filament the commanded volume is 3,860.98 mm³ versus a 508.264 mm³ section slab at 0.2 mm height. These are commanded geometric comparisons, not measured polymer volume or a calibrated flow diagnosis.

Exact final-byte extraction, including travel/retraction path separation, was independently audited against the previous actual G-code layer. At Z121.4 nominal contact fraction is 0.6649, longest unsupported run 36.00 mm, **284 runs exceed the 12 mm bridge budget**. The next layer has three additional findings (287 across both checked layers). Source-geometry audit has 284 + 2 findings; rounding/resampling in final commands changes the next-layer sampled result. Do not substitute the source count for final bytes.

Final Z121.4 extrusion lines are **2,648,963–2,769,154**. Previous Z121.2 extrusion lines are 2,642,345–2,648,951. First three final-byte problems:

| G-code lines | Unsupported run | First extruding segment XY | Last segment XY |
|---|---:|---|---|
| 2,649,251–2,649,281 | 14.718 mm | (87.305,108.981) → (86.946,108.644) | (86.554,108.257) → (86.911,108.591) |
| 2,649,293–2,649,332 | 19.186 mm | (86.577,108.257) → (86.226,107.923) | (86.263,107.973) → (86.616,108.309) |
| 2,649,425–2,649,457 | 16.371 mm | (86.920,108.607) → (86.559,108.265) | (86.168,107.879) → (86.527,108.218) |

Anchors are explicit in `sokol-final-transition-audit.json`, including prior-layer segment line numbers. First run's left/right nominal anchor distances are 0.414718/0.417441 mm to previous-layer lines 2,644,604/2,644,605. The longest 36.003 mm run is at lines 2,694,349–2,694,426, with anchors to prior-layer lines 2,645,534 and 2,645,529. Short endpoint displacement does not mean a short unsupported run: the emitted path doubles back through a much longer route.

Method: XY segment-distance tests at length-weighted midpoint samples no farther than 0.35 mm apart; support requires distance ≤0.42 mm, the sum of nominal half-beads. No inherited extra 0.6 mm allowance. This is a conservative digital contact criterion, not measured weld strength or a continuous proof between samples.

## Source annotations and mechanism

`core/weft_field_geometry.mjs:990` switches a collapsed offset/no-hole section to `rimOnly`; lines 994–1006 construct a plain inward schedule through the section and call `rimSpiralPlain`. That function at lines 418–425 projects every whole-boundary turn inward with `toDepth`. At the narrow 3→1 union the serialized layer records `plain rim to the centre + none`, not scan fill. Its 121,232 source points and 51.2 m length are retained in the delivered file. The source point count differs from final segment count because output may simplify/merge moves.

The concrete fault is an excessive, overlapping path at the merge plus insufficient nominal support. Projection/offset behavior at the narrow union is the code-level mechanism to investigate; no fresh generation was run to isolate a particular mathematical operation. The sparse `summary.layerProgram` records every fifth layer and **omits k606**, so its nearby 2.7–3.5 m summaries conceal the 51.2 m outlier. Inspect every layer when qualifying a new design.

The old delivered S1 and layered S4 reports passed under the inherited profile, `allow=0.6`, geometry `supportReach_mm=0.9`, bead 0.42 mm marked **ASSUMED**. That does not invalidate the stricter nominal refusal above. No gate was rerun with weaker limits.

## Topology and photographed stage

Use commanded top Z, not the summary event's bottom Z (they differ by 0.2 mm):

- Z9.0: foundation/rock splits into five parts.
- Z35.2: legs unite, five → four parts.
- Z46.8–53.6: dense cover band before tail/body union.
- Z57.8: tail/body unite, four → three parts.
- Z117.8–121.2: dense cover band; central body and two wing blades remain separate.
- **Z121.4: three → one**, the pathological inward-rim layer above.
- Z134.2: neck program; source code proposes Hilbert, serialized actual paths use lines.
- Z152.2: head begins, lines rotate by 30°; V2c moved capZ above the object, so no spiral crown program remains.

Viewed originals `1-1000146474.jpg` and `3-1000146472.jpg`: broad central red lattice and two narrow lateral red rectangles remain, with loose raised strands and tangles. This is consistent with the separate body/wing stage, and therefore the failed merge is a strong candidate. It is **not a measured Z assignment or proof of the physical onset**. The photos do not establish that the final head or tiny crown was reached.

Bounded source audits also found 3.76 mm cantilever at Z35.2; 9.79 mm at Z53.8; a 21.90 mm bridge at Z57.8; and 15 nominal findings in the later Z128–188 window, mainly Z136 with up to 32.90 mm runs. These are further digital defects, not evidence that the pictured part failed at every such height.

## Speed, time, cooling and the new ~2 h target

The complete delivered file has 940 distinct deposition Z levels, height188 mm and 1,404.411 m deposited path. Feed lengths: 8.856 m at12 mm/s, 1,318.218 m at18 mm/s, 77.336 m at50 mm/s. The source sets speed50, but bridge-role output is18. Feed-limited extrusion time is **20.978 h**, motion including travel/retraction approximately **21.248 h**, excluding heat-up, acceleration and firmware effects. The old report's `kinematic_h:13` must not be used to predict this file's actual duration.

At the three-part body stage Z57.8–121.2, layer motion lower bounds are 87.357–162.962 seconds. Very short layers occur only near the crown: final Z188 has 6.736 s extrusion / 7.276 s with following travel; six top layers are below10 s. No G4 dwell exists. Fan is commanded M106 S255 after first Z0.2 layer and stays there to the end. Start macro requests220°C /60°C. Actual fan performance, material, temperatures, collision dynamics and adhesion are not measured by this audit.

For the newly authored small falcon: measure final G-code time, not source speed or old kinematic estimate; avoid projected concentric fallback at thin unions; preserve each part/intent; require nominal contact plus unchanged final gates and inspect every per-layer length/volume outlier. Adding a small-layer dwell alone would not repair a 51 m merge layer. Geometry redesign is appropriate; relabeling or blindly shrinking this old file is not qualification.

## Audit artifacts / honest verdict

- `sokol-failure-audit.mjs` and `.json`: complete final G-code timing, source topology, bounded Z128–188 nominal audit.
- `sokol-source-transition-audit.mjs` and `sokol-failure-transitions.json`: bounded source checks at Z35–36,46.6–59,87.8–89,117.6–124.6.
- `sokol-final-transition-audit.mjs` and `.json`: actual final Z121.2/121.4/121.6 extraction, hashes, line numbers, contact results, anchor witnesses.

All are in the same scratch directory as this note. Run each script with the canonical WEFT project root and output JSON path as its two arguments. The first script optionally accepts a lower Z bound as third argument (128 in this audit). The scripts resolve the installed private-studio nominal auditor from that project root. Its SHA-256 is `fd5604ad9ef24bd561fa22c478ec584a1a31fa274d4416f2453abf00ad789387`, verified equal to the staging module used during measurement. Original project and delivered files were read-only. This is a confirmed path pathology and an evidence-backed failure hypothesis. It is not a bound reconstruction of the physical failure, a full new audit of every original layer, or evidence of a successful replacement print.
