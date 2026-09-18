# PROTOCOL — printing and reading the ZIGURAT2 pair (2026-09-18)

Both pyramids passed the WEFT gate at their declared 36 mm ceiling with zero findings and one first-layer island.
At the evidenced 16.2 mm ceiling every finding falls in the crown or on a horn — **no finding anywhere in a corner
cut**, which is the claim this pair is built to test. "Passed" means every deposited path has something under it
in the layer immediately below; it does not mean the object will print, and it says nothing about sag.

## Before printing
1. Do not scale, move, rotate or re-slice. Bambu: load the `.gcode.3mf` directly. Ender: send the plain `.gcode`
   through Moonraker/Klipper as GORA was sent.
2. Verify SHA-256 against `manifest.json` / `SHA256SUMS.txt`. If the file arrived in parts, run
   `_transfer\REASSEMBLE.cmd` first — it prints the hash to compare.
3. Clean plate, glue as for OBLAK. Only the lowest tier touches the plate; there is no slicer brim, the rings and
   spokes are built in.
4. Nozzle/bed as the file says. Part cooling 100 %.

## During printing — what to photograph
- z 0–3 mm: the first layer is ONE piece. Overhead frame before the second layer.
- **The start of each cut** (A2L z 7.2 / 37.0 / 58.9 / 74.6; Ender z 7.0 / 22.4 / 33.4): the moment the first
  45° chords appear across the four corners. One frame at the start, one at half, one when the four cuts meet and
  the square has become the rotated square. This is the whole experiment.
- Each ramp from the side, low, against a straight edge or a rule: **the sag of the ramp is the measurement**.
- The horns (Ender only), the crown approach, and every crown layer if you can.
- Any break, wobble or detachment: photograph immediately with the layer number from the display.

## After printing (before removal)
- Overhead; four sides at 45° with a lamp at 45°; macro of each ramp from above and from below (lamp under the
  plate — the interior is open all the way up); the crown from above and from inside; one frame per grammar band.
- Remove, weigh, and measure: the droop of each ramp at the middle of a cut chord against the plane of the tier
  edge below it (mm), the rotation of each tier against the one below (degrees, expected 45), the crown sag at
  the centre, the horn tips. Write `outcomes.md`; copy photos into `photos/<date>_<who>/` with a SHA-256 manifest;
  rename `_experimental` → `_physical`.

## What would make this a failure worth keeping
A ring dropping inside a cut means 0.5 mm/layer is too fast for a 45° chord and the rate has a number. That is a
result, not a loss — photograph the layer and keep the object.
