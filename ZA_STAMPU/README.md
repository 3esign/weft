# ZA_STAMPU — shelf for the printer, on the PC

Everything in here is a finished build. Nothing needs slicing.

**Every file names the printer it is for**: `_A2L`, `_A1` or `_ENDER` is part of the file name, and each
printer has its own folder. A Bambu `.gcode.3mf` built for one machine is refused by Bambu Studio on
another ("the selected printer (A2L) is incompatible with the print file configuration (A1)"), so take
the file from the folder of the printer you are sending to.

- `A2L_Bambu/` — `.gcode.3mf` for the **Bambu Lab A2L** (0.4 nozzle, Textured PEI, bed 55 °C).
- `A1_Bambu/` — `.gcode.3mf` for the **Bambu Lab A1** (0.4 nozzle, Textured PEI, bed 65 °C).
- `CREALITY_Ender3V4/` — plain `.gcode` for the **Ender-3 V4**. Copy onto the SD card and print.

A `.gcode.3mf` opens in Bambu Studio through **File → Open Project (Ctrl+O)** or by dragging it onto
the window. *Import model* filters for meshes and will not list it. The plain `.gcode` beside it goes
straight to the SD card without Studio.

Source of truth for each file is `specimens/<date>_<name>_<printer>/`, with its gate report, manifest and
SHA-256. This folder is a copy for convenience, not a second origin.

## What is on the shelf

| file | machine | mm | layers | thread | g | time (container) |
|---|---|---|---|---|---|---|
| STOLICA_A2L | Bambu A2L | 82.3 × 89.2 × 169.9 | 708 | 756.7 m | 93.1 | 12h 57m |
| SOKOL_A2L   | Bambu A2L | 88.5 × 85.4 × 187.9 | 783 | 1141.0 m | 142.5 | 18h 49m |
| STOLICA_A1  | Bambu A1  | 82.3 × 89.2 × 169.9 | 708 | 756.7 m | 93.4 | 12h 58m |
| SOKOL_A1    | Bambu A1  | 88.5 × 85.4 × 187.9 | 783 | 1141.0 m | 142.7 | 18h 50m |
| PUN_KOCKA_ENDER   | Ender-3 V4 | 42 × 42 × 24     | 120 | 141.1 m | 14.12 | 1h 48m |
| PUN_SUNDJER_ENDER | Ender-3 V4 | 36.8 × 36.6 × 20 | 100 | 57.1 m  | 5.96  | 44m |
| PUN_DRVO_ENDER    | Ender-3 V4 | 27 × 27 × 30     | 150 | 28.8 m  | 3.29  | 21m |

The A2L and the A1 files of each body are the **same toolpath**, re-centred on each machine's plate and
wrapped in that machine's own start/end blocks and project settings. Both machines run the same bead
(0.45 mm) and layer (0.24 mm), so nothing about the body changes between them.

## Before you trust the millimetres

The **A2L bead 0.45 is measured**, so the A2L files stand on a real number. The bead on the
**A1 (0.45)** and on the **Ender (0.42)** is ASSUMED, never calibrated — run the C1 thin-wall test on
each machine and write the measured width into `machines.json`.

Every body here is pure weft: no wall, no infill, one continuous line per island per layer.
`tools/check_pure_weft.mjs` reports 0 walls in each shipped file.
