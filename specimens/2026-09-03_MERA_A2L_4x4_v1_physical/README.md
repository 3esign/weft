# MERA A2L 4×4 · physical record, withdrawn from ready-to-print reuse

> **Current status, 2026-09-04:** the green photographs belong to this older small MERA test family,
> not to LIMIT16. Real Z and the walls survived, but the four single-layer membrane centres most
> consistently read as about one mostly formed and three collapsed. Do not resend either MERA
> printable artifact as a qualified build. Read [outcomes.md](outcomes.md) and
> [membrane_process_status.json](membrane_process_status.json). The exact printed v1/v2 hash cannot
> be recovered from the cropped photographs.

Sixteen shallow, open WEFT instruments on one connected foundation. This is the short, safe plate made
after the 240 mm Penjač failed from physical instability: **22.08 mm high**, open to inspection from above,
and wide enough that wobble is not the experiment.

## Historical package — not a current print instruction

`MERA_A2L_4x4_v1_A2L.gcode.3mf`

- machine: **Bambu Lab A2L**, 0.4 mm nozzle
- material encoded in the file: PLA, 220 °C / 55 °C bed
- occupied plate area: X 54.7–275.0 / Y 47.0–270.0 mm
- model envelope: **220.8 × 223.4 × 22.08 mm**
- 92 object layers at 0.24 mm; 43.0 g estimate; about **5 h 02 min** including acceleration allowance
- first layer: one connected island, 16 annular brims joined by a thin grid
- historical geometric G-code gate: **PASS — 0 problems** over 354,196 checked points
- Bambu layer dialect: **92 `CHANGE_LAYER` markers**; Studio must show layers 1–92, not only layer 1
- four internal membrane rims: geometric anchoring **1.000 / 1.000 / 1.000 / 1.000**; this did not
  predict physical centre formation
- same-layer unintended overlaps: **0**

The files and measurements below are retained as historical evidence. They are not deleted or silently
rewritten, but the physical outcome supersedes the old ready-to-print claim.

The package generated earlier on 2026-09-03 used Cura-style layer comments. Semir caught that Bambu Studio
flattened its Preview into layer 1. That artifact was withdrawn and this file was regenerated in Bambu's own
`CHANGE_LAYER / Z_HEIGHT / LAYER_HEIGHT` dialect. **The Preview layer slider must end at 92 before printing.**

## What the grid means

Read left-to-right, top-to-bottom. The small hash marks below each cell repeat 1–4 by column; the row is
unambiguous from its position.

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| row 1 | vertical wall | light lean | medium lean | strongest lean |
| row 2 | staple | perpendicular | diagonal | sine |
| row 3 | circular cap, closed core | circular cap, 0.6 mm core | peanut cap, 1.2 mm core | clover cap, 2.0 mm core |
| row 4 | ellipse + staple | rounded square + staple | peanut + diagonal | clover + eight |

## Photograph after printing

1. Whole plate directly from above, still on the bed.
2. Rows 1 and 2 from the side in raking light.
3. Row 3 directly above, close enough to see all four membrane centres and rims.
4. Row 4 from above, then any failure separately.

Do not remove failed strings or membranes before the first photographs. The defect is the measurement.

## Honest scope

This v1 does not deliberately print a path the current gate already knows to be invalid. It therefore does
not include the original spec's 25%-anchored membrane or over-limit cantilever. It measures five grammars,
four lean profiles, four membrane/core variants and four non-circular contours in one short physical run.
The larger bridge/cantilever calibration ladder remains the next plate after this one establishes the base.
