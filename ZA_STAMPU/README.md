# ZA_STAMPU — shelf for the printer, on the PC

Everything in here is a finished build. Nothing needs slicing.

- `CREALITY_Ender3V4/` — plain `.gcode`. Copy onto the SD card and print. No slicer involved.
- `A1_Bambu/` — `.gcode.3mf` opens in Bambu Studio through **File → Open Project (Ctrl+O)**
  or by dragging it onto the window. *Import model* filters for meshes and will not list it.
  The plain `.gcode` beside it goes straight to the SD card without Studio.
- `A2L_Bambu/` — the enlarged SOKOL. Built separately; see the folder.

Source of truth for each file is `specimens/<date>_<name>/`, with its gate report,
manifest and SHA-256. This folder is a copy for convenience, not a second origin.

## What is on the shelf

| body | machine | mm | layers | thread | g | time |
|---|---|---|---|---|---|---|
| PUN_KOCKA   | Ender-3 V4 | 42 × 42 × 24   | 120 | 141.1 m | 14.12 | 1h 48m |
| PUN_SUNDJER | Ender-3 V4 | 36.8 × 36.6 × 20 | 100 | 57.1 m | 5.96 | 44m |
| PUN_DRVO    | Ender-3 V4 | 27 × 27 × 30   | 150 | 28.8 m | 3.29 | 21m |
| SOKOL (small) | Bambu A1 | 88.5 × 85.4 × 187.9 | 783 | 1141.0 m | 142.7 | — |
| STOLICA     | Bambu A1 | 82.3 × 89.2 × 169.9 | 708 | 756.7 m | 75.64 | 2h 36m |
| SOKOL (large) | Bambu A2L | H 280 | 1167 | — | — | — |

## Before you trust the millimetres

The bead on the **Ender (0.42)** and on the **A1 (0.45)** is ASSUMED, never calibrated —
run the C1 thin-wall test on each machine and write the measured width into
`data/machines.json`. The **A2L bead 0.45 is measured**, so the large SOKOL's dimensions
stand on a real number.

Every body here is pure weft: no wall, no infill, one continuous line per island per layer.
`tools/check_pure_weft.mjs` reports 0 closed strokes in each shipped file.
