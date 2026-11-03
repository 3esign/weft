# SOKOL — reported Ender failure, 2026-10-04

Semir reported “Sokol pao sokol pao” with five photographs, then identified it as the latest Ender print. The corresponding latest local delivery is `SOKOL_V2c/SOKOL_V2_ENDER.gcode`, SHA-256 `d7b09b685db757da401bf3d7b136b93aa00b9457287afc1120c155bcf4818832`. This is a user-supported candidate association; bytes read from the printer's storage were not supplied. `evidence.json` records the original attachment locations, all image hashes and this distinction. `originals/` contains byte-identical copies, never edited or generated substitutes.

## Direct observations

- Photographs 1–3 show the white base and lower members retaining their form. Several regular red rows exist above the white/red transition; no clear open crack is visible at the transition itself.
- The upper red lattice carries loose raised loops, bent strips and long stray strands. The two narrower lateral regions still have recognizable structured lines.
- Photograph 4 shows the object standing on the printer plate and a large tangled red extrusion mass extending to its right. It does not show the instant at which the nozzle first contacted or displaced a strand.
- Photograph 5 shows much of the top lattice still regularly formed; the toolhead hides part of the central area. File numbering alone does not establish chronology.

Color is an observed appearance, not a material specification. These pictures do not measure temperature, flow, moisture, melt viscosity, bond strength, or identify the initiating failure layer. The visible surviving lower body makes a global first-layer detachment less consistent with these frames, but does not measure adhesion.

## Working hypotheses and response

**Confirmed final-file defect:** at commanded Z121.4 mm, the three-to-one body/wing merge emits 51,195 mm of extrusion in one layer (18.36 times the preceding layer), taking 47.4 minutes at the commanded feed. The actual final path contains 284 nominally overlong bridge runs, up to 36.00 mm. The inherited `rimOnly` inward projection produces the excessive path; identifying the exact mathematical operation that caused it still requires a separate reproduction. Full line-number and anchor evidence is in [the independent audit](sokol-failure-AUDIT.md). A second complete-file parser independently confirms the length spike and approximately 21.25 h ideal motion total. This is a strong failure candidate consistent with the visible stage, not a confirmed measurement of the photographed failure Z.

First inspect anchoring at upper transitions and the starts/ends of strands, then later passes through regions with accumulated loose material. Insufficient initial anchoring and subsequent dragging can coexist; the pictures do not determine their order. A process interruption or filament-change issue remains possible. Regular red layers above the color boundary do not support claiming an immediate complete failure at that boundary.

The new, separately versioned `private-studio/specimens/2026-10-04_SOKOL_MALI/` is an original compact perched falcon, not a geometrically scaled copy. Its design target is approximately two hours on the inherited Ender profile, with broad connected support, folded wings, a supported short hook and an open exterior. Its final status must come from actual read-back G-code checks. A new digital pass will remain physically UNPRINTED.

## Honest-verdict

Verified: all five supplied images were visually inspected, copied without modification and hashed; the current local candidate file was read and hashed; excessive final extrusion and insufficient nominal support at Z121.4 mm are independently documented. Reported: failure of the latest Ender print. Inferred: that defective merge is a strong candidate for the photographed upper-region failure, potentially amplified by later dragging. Unseen: first failure event, chronology, exact failed Z, executed storage hash, material identities and machine logs. Original historical digital gate receipts remain unchanged.
