# PROTOCOL — printing and reading the ZIGURAT pair (2026-09-17)

Both pyramids are declared experiments. They passed the WEFT gate at their declared bridge ceiling (60 mm on
the A2L, 52 mm on the Ender) with zero findings, and a second gate at the evidenced 16.2 mm whose findings all
fall inside the declared zones — the first radial layer of every terrace and the first levels of the roof
(`*_gate.json`, `*_gate_at_16.2mm.json`, `*_report.json` → `gateAtEvidencedCeiling`). "Passed" means every
deposited path has something under it by the geometric rule, in the layer immediately below; it does not mean
the object will print. Print them as instruments: the height and the place of a failure is the result, and
the sag of every terrace and of the roof is the measurement.

## Before printing
1. Do not scale, move, rotate or re-slice. Bambu: load the `.gcode.3mf` directly (Studio/Handy → print the packed
   G-code); the slider must show all 665 layers. Ender: send the plain `.gcode` through Moonraker/Klipper as GORA was.
2. Verify the SHA-256 of the file you send against `manifest.json` / `SHA256SUMS.txt` (`Get-FileHash`). If the file
   arrived in parts (`_transfer/`), run `_transfer\REASSEMBLE.cmd` first; it prints the hash to compare.
3. Clean plate, glue as for OBLAK. This is the widest first layer WEFT has printed (289 / 189 mm of brim edge):
   watch the four outer corners for the first ten layers — a lifting corner means abort, not "let it run".
   Same filament/colour as OBLAK (A2L) and GORA (Ender) if possible; write filament and room temperature into
   `outcomes.md`.
4. Nozzle/bed as the file says. Part cooling 100 % (the terraces and the roof are bridges).

## During printing — what to photograph (one frame per event, phone is fine)
- z 0–3 mm: the first layer is ONE piece (rings, spokes, ribs between the tubes, the floor grid). Overhead frame
  before the second layer.
- The hidden tubes: an overhead frame every ~10 mm while the inner tubes are visible from above — the nested
  lattices and their relative rotation are worth one frame each tier.
- Each terrace (A2L z 39 / 78 / 117; Ender z 34 / 68): photograph the FIRST radial layer the moment it is laid
  (the corner diagonals are the longest chords of the object), then after the two spirals, then the finished
  terrace. Sag under a terrace is the measurement: from the side, at plate level, with a rule against the rim.
- The roof (last 3 mm): every roof layer if you can; the first (one/two full-span chords) decides.
- Any break, wobble, detachment: photograph immediately with the layer number from the display.

## After printing (before removal)
- Overhead; four sides at 45° with a lamp at 45°; macro of each terrace corner from above and from below (lamp
  under the plate, through the tubes); the roof from above and below; one frame per grammar band; the twisted
  corners of the upper tiers against a straight edge.
- Remove, weigh (g), measure: sag at the centre of each terrace side and at each corner (mm below the rim), roof
  sag at the centre and quarter points, the twist of each tier's top against its base (degrees), horn tips.
  Write `outcomes.md`; copy the photos into `photos/<date>_<who>/` with a SHA-256 manifest (as the OBLAK/GORA
  folders); rename `_experimental` → `_physical`.

## How the file got here
Built in a cloud session (Node 22, Playwright Chromium for the previews), gated there, files over 19 MB split
into `_transfer/*.partNN`, written to the PC through the Cowork bridge, reassembled with `copy /b`
(`_transfer\REASSEMBLE.cmd`) and verified against the SHA-256 computed in the cloud.
