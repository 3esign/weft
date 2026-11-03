# ZA_STAMPU — shelf for the printer, on the PC

Everything in here is a finished build. Nothing needs slicing.

**Every file names the printer it is for**: `_A2L`, `_A1` or `_ENDER` is part of the file name, and each
printer has its own folder. A Bambu `.gcode.3mf` built for one machine is refused by Bambu Studio on
another ("the selected printer (A2L) is incompatible with the print file configuration (A1)"), so take
the file from the folder of the printer you are sending to.

- `A2L_Bambu/` — `.gcode.3mf` for the **Bambu Lab A2L** (0.4 nozzle, Textured PEI, bed 55 °C, plate 340 × 320 × 340 mm).
- `A1_Bambu/` — `.gcode.3mf` for the **Bambu Lab A1** (0.4 nozzle, Textured PEI, bed 65 °C, plate 256 × 256 × 256 mm).
- `CREALITY_Ender3V4/` — plain `.gcode` for the **Ender-3 V4** (plate 220 × 220 × 250 mm). Copy onto the SD card and print.

A `.gcode.3mf` opens in Bambu Studio through **File → Open Project (Ctrl+O)** or by dragging it onto
the window. *Import model* filters for meshes and will not list it. The plain `.gcode` beside it goes
straight to the SD card without Studio.

Source of truth for each file is `specimens/<date>_<name>/` or `private-studio/specimens/<date>_<name>/`, with its gate report, manifest and SHA-256. This folder is a copy for convenience, not a second origin.

## What is on the shelf

### 1. Bambu Lab A2L (`A2L_Bambu/`)

| Path in `A2L_Bambu/` | Envelope (mm) | Layers | Thread | Net Mass (g) | Est. Time | SHA-256 (prefix) | Status / Notes |
|---|---|---:|---:|---:|---:|---|---|
| `KOCKA_REVERZ_A2L_250/KOCKA_REVERZ_A2L_250.gcode.3mf` | 250.0 × 250.0 × 249.6 | 1,040 | 1,968.2 m | **233.5 g** | 26h 14m | `8924e654e1bd...` | **Single-thread revertible hollow cube (`98.79%` hollow, `204` point-welds/layer, `0` body retractions, 5 layer patterns, 3D relief facade + inner morphing pavilion).** (`KOCKA_REVERZ_A2L_250.gcode` sha256: `3d93265650d4...`). |
| `AER_DOME_A2L_V2/AER_DOME_A2L_v2.gcode.3mf` | 200.4 × 200.4 × 180.0 | 750 | 8,770 m | **1,092.2 g** | 182h 53m | `9c09ba7d5ec5...` | Open porous hemisphere + 3 inner curtains (`full04_tied`). **Requires >1 kg filament (use 2 kg spool or AMS auto-refill).** |
| `AER_A2L_V1/AER_A2L_v1.gcode.3mf` | 303.9 × 303.9 × 243.1 | 1,013 | 3,024 m | 376.6 g | 102h 45m | `f72da3e961fd...` | Open porous truncated sphere (`full17_nominal`), 1 connected component, S1/S2/S4/nominal PASS. Fits on a single 1 kg spool. |
| `AER_CROWN_COUPON_A2L_V1/AER_CROWN_COUPON_A2L_v1.gcode.3mf` | 59.0 × 59.0 × 14.4 | 60 | 112.1 m | 11.94 g | 1h 54m | `faf65cd4cb80...` | Rapid qualification coupon for open-weave ring/crown and spatial anchoring (`scalable-weft.mjs`) before running 102h/182h domes (`AER_CROWN_COUPON_A2L_v1.gcode` sha256: `1527d0700b9e...`). |
| `SPHERE_ORBIT_A2L_R06/SPHERE_ORBIT_A2L_r06.gcode.3mf` | 150.2 × 150.0 × 135.1 | 563 | 988.7 m | 150.8 g | 22h 06m | `e0636b910700...` | Woven sphere with 3 orthogonal interior ribs (dense outer skin; superseded by `AER_A2L_v1` for open-pore requirement). |
| `LIRA/LIRA_A2L.gcode.3mf` | 112.2 × 109.9 × 216.0 | 900 | 1,452 m | 180.9 g | 27h 36m | `6f5654726674...` | Full woven chair sculpture (`LIRA_A2L.gcode` sha256: `9349a90af2a5...`). |
| `LIRA/LIRA_ROOT_A2L.gcode.3mf` | 112.2 × 109.9 × 19.2 | 80 | 134 m | 16.7 g | 2h 02m | `c33be44b1230...` | First 80 layers of LIRA for physical bed-adhesion and foot-transition verification. |
| `PERSIAN_MANE_A2L_R2/PERSIAN_MANE_A2L_R2.gcode.3mf` | 88.2 × 125.9 × 162.0 | 675 | 495.5 m | 83.2 g | 13h 29m | `6abebba7fd2e...` | Seated cat (`PERSIAN_MANE_A2L_R2.gcode` sha256: `02c577db2efd...`). |
| `SOKOL_A2L.gcode.3mf` | 88.5 × 85.4 × 187.9 | 783 | 1,141.0 m | 142.5 g | 18h 49m | `6ad53a26beb3...` | Perched peregrine (`SOKOL_A2L.gcode` sha256: `7e7dd2cec45f...`). |
| `STOLICA_A2L.gcode.3mf` | 82.3 × 89.2 × 169.9 | 708 | 756.7 m | 93.1 g | 12h 57m | `65bc6bb9dbed...` | Four-legged woven chair (`STOLICA_A2L.gcode` sha256: `7508018e69fc...`). |

### 2. Bambu Lab A1 (`A1_Bambu/`)

| Path in `A1_Bambu/` | Envelope (mm) | Layers | Thread | Net Mass (g) | Est. Time | SHA-256 (prefix) | Status / Notes |
|---|---|---:|---:|---:|---:|---|---|
| `SOKOL_A1.gcode.3mf` | 88.5 × 85.4 × 187.9 | 783 | 1,141.0 m | 142.7 g | 18h 50m | `7bc118b5d4b2...` | Perched peregrine (`SOKOL_A1.gcode` sha256: `c74e3d7381b7...`). |
| `STOLICA_A1.gcode.3mf` | 82.3 × 89.2 × 169.9 | 708 | 756.7 m | 93.4 g | 12h 58m | `9550048af38d...` | Four-legged woven chair (`STOLICA_A1.gcode` sha256: `0cdfb568c8d6...`). |
| `C1_CALIBRATION_A1.gcode` | 40.0 × 40.0 × 12.0 | 50 | — | — | 8m | `c54d5c0c8d46...` | Thin-wall bead calibration test (`0.45 mm` nominal). |

### 3. Creality Ender-3 V4 (`CREALITY_Ender3V4/`)

| Path in `CREALITY_Ender3V4/` | Envelope (mm) | Layers | Thread | Net Mass (g) | Est. Time | SHA-256 (prefix) | Status / Notes |
|---|---|---:|---:|---:|---:|---|---|
| `KOCKA_REVERZ_ENDER_150/KOCKA_REVERZ_ENDER_150.gcode` | 150.0 × 150.0 × 150.0 | 750 | 842.8 m | **78.87 g** | 12h 16m | `ea8612831d6a...` | **Single-thread revertible hollow cube (`98.12%` hollow, `128` point-welds/layer, `0` body retractions, 5 layer patterns, 3D relief facade + inner morphing pavilion).** |
| `MIRA_ENDER_V4/MIRA_ENDER_v4.gcode` | 125.9 × 150.7 × 224.0 | 1,120 | 1,213 m | 151.1 g | 33h 43m | `a0c8e07ee388...` | Upright seated cat v4 (`anatomy-v2-full-local4`) with distinct paws, haunches, tail root, and 100% nominal contact. |
| `SPHERE_ECHO_ENDER_R09/SPHERE_ECHO_ENDER_r09.gcode` | 132.4 × 132.2 × 118.8 | 594 | 822.4 m | 125.5 g | 17h 50m | `cfde48cb925a...` | Woven sphere with 3 orthogonal interior ribs for Ender-3 V4. |
| `SOKOL_UZLET_R7/SOKOL_UZLET_ENDER_R7.gcode` | 150.5 × 97.6 × 106.0 | 530 | 456.8 m | 69.6 g | 5h 29m | `b6d9726b03a7...` | Rising falcon with 8 primary feathers per wing and 40 transverse tie ribs. |
| `SOKOL_MALI_R3/SOKOL_MALI_ENDER_R3.gcode` | 59.3 × 34.0 × 38.0 | 190 | 164.0 m | 25.0 g | 1h 52m | `2d9efcc8eb62...` | Compact folded-wing landing falcon. |
| `PERSIAN_FOLD_ENDER_R2/PERSIAN_FOLD_ENDER_R2.gcode` | 126.9 × 93.7 × 140.0 | 700 | 369.5 m | 56.8 g | 12h 06m | `bdb7b6a126d7...` | Compact folded-ear cat with 10s minimum layer cooling. |
| `SOKOL_V2c/SOKOL_V2_ENDER.gcode` | 88.5 × 85.4 × 187.9 | 783 | 1,141.0 m | 142.5 g | 18h 49m | `d7b09b685db7...` | **WARNING: Physically failed on 2026-10-04 (high-aspect feather tips). Retained for forensic provenance; print `SOKOL_MALI_R3` or `SOKOL_UZLET_R7` instead.** |
| `PUN_KOCKA_ENDER.gcode` | 42.0 × 42.0 × 24.0 | 120 | 141.1 m | 14.12 g | 1h 48m | `2ab2d0852211...` | Pure-weft v1 cube specimen. |
| `PUN_SUNDJER_ENDER.gcode` | 36.8 × 36.6 × 20.0 | 100 | 57.1 m | 5.96 g | 44m | `864d69f61afa...` | Pure-weft v1 sponge specimen. |
| `PUN_DRVO_ENDER.gcode` | 27.0 × 27.0 × 30.0 | 150 | 28.8 m | 3.29 g | 21m | `0258c9c01f06...` | Pure-weft v1 branching tree specimen. |
| `C1_CALIBRATION_ENDER.gcode` | 40.0 × 40.0 × 12.0 | 60 | — | — | 8m | `781f77b2953d...` | Thin-wall bead calibration test (`0.42 mm` nominal). |

## Before you trust the millimetres

The **A2L bead 0.45 is measured**, so the A2L files stand on a real number. The bead on the
**A1 (0.45)** and on the **Ender (0.42)** is ASSUMED, never calibrated — run the C1 thin-wall test on
each machine and write the measured width into `machines.json` and `OUTCOMES_REGISTRY.json`:

```bash
# View all 30 shelf artifacts, their SHA-256 hashes, and physical status:
node private-studio/agent.mjs outcomes

# Record C1 caliper measurement (0.25–0.80 mm):
node private-studio/agent.mjs calibrate-c1 --machine ender --coupon CREALITY_Ender3V4/C1_CALIBRATION_ENDER.gcode --bead 0.42 --notes "Caliper 4-wall mean"

# Bind a physical print outcome and photos to its exact SHA-256:
node private-studio/agent.mjs record-outcome --artifact CREALITY_Ender3V4__MIRA_ENDER_V4__MIRA_ENDER_v4 --status PRINTED_PASS --grams 151.1 --photo "photo1.jpg" --notes "Printed cleanly on Ender-3 V4"
```
