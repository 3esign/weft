# PROTOCOL — printing and reading OBLAK / GORA (2026-09-05)

Both sculptures are declared experiments. They passed the WEFT gate at their declared 60 mm bridge ceiling
with zero findings, and a second gate at the evidenced 16 mm whose findings all fall inside the declared
instrument zones (see `*_gate.json`, `*_gate_at_16mm.json`, `*_report.json` → `gateAtEvidencedCeiling`).
"Passed" means every deposited path has something under it by the geometric rule; it does not mean the
object will print (P2b passed and broke). Print them as instruments: the height and place of a failure is
the result.

## Before printing
1. Do not scale, move, rotate or re-slice the file. Bambu: load the `.gcode.3mf` directly (Handy / Studio → print
   the packed G-code); check that the Studio slider shows all layers (OBLAK 801 model levels). Ender: send the
   plain `.gcode` through Moonraker/Klipper as the LIMIT16 and Vrtlog files were sent.
2. Verify the SHA-256 of the file you send against `manifest.json` (`Get-FileHash` on Windows) — the photos
   will be bound to that hash.
3. Clean plate, glue as for the D5 dome (annular foundation + spokes are built in; no slicer brim exists).
   Same filament and colour as the LIMIT16 plate of the same machine if possible; write filament, room
   temperature and any manual intervention into `outcomes.md`.
4. Print nozzle/bed as the file says (A2L: harvested block; Ender: 220/60). Part cooling 100 % (the lintels
   and horns are bridges; LIMIT16 bridges held with full cooling).

## During printing — what to watch and photograph (phone is fine, one frame per event)
- z 0–5 mm: the first layer is ONE connected piece (rings + spokes + the wall). Photograph before the second layer.
- OBLAK z 21–80 / GORA z 15–38: the grammar bands (perp, sine, eight, diagonal). One raking-light frame per band.
- Windows: the first arc layers (OBLAK z 80 / 89 / 98; GORA z 39 / 48 / 57 / 66) and the LINTEL layer
  (OBLAK z 125.3; GORA z 83.6) — photograph the three (four) chords the moment they are laid, then five
  layers later. Sag under each lintel is the measurement: photograph from below the plate level, with a ruler.
- Horns: OBLAK z 125–177 (30 at 125–144, 40 at 134–159, 50 at 146–177); GORA z 104–170 (20/30/40/50 in that
  order). Watch for upward curl (nozzle collision risk) — if a horn tip curls up and the nozzle catches it,
  pause and photograph before deciding; a lost horn is a result, a knocked-off sculpture is not.
- Crown: the last 8 mm (OBLAK z 182–191; GORA z 170–191). The iris: six chord layers on the last ring.
  Photograph each iris layer if you can; the first one (span ~31 / 26 mm) is the one that decides.
- Any break, wobble or detachment: photograph immediately with the layer number from the printer display.

## After printing (before removal)
- Overhead, then four sides at 45° with a lamp at 45°, then macro of: each lintel from below, each horn tip from
  the side, the crown from above and from inside (through the base), one grammar band each.
- Remove, weigh (g), measure the crown hole and each horn's droop at the tip (mm below its designed line),
  and the lintel sag (mm). Write `outcomes.md`; copy the photos into `photos/<date>_<who>/` with a SHA-256
  manifest (as `2026-09-04_LIMIT16_*_physical/photos/`). Rename the folder `_experimental` → `_physical`.

## How the file got here (transfer)
Built in a cloud session (Python 3 + numpy/scipy/scikit-image + Node + Playwright Chromium), gated there,
split into ≤ 20 MB chunks, written to the PC through the Cowork bridge, and reassembled with `copy /b`
(`_transfer/REASSEMBLE.ps1`); the SHA-256 in `manifest.json` was computed in the cloud and verified on the
PC after reassembly.
