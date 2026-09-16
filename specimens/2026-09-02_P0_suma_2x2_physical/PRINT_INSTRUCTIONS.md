# P0 Šuma 2×2 — print instructions

**Route B (recommended, ~1.6 h):** copy `P0_suma_2x2_routeB.gcode` to the A2L (SD card or Bambu Handy/Studio "send G-code").
White PLA, textured PEI plate, the same spool family as D5. Watch the first 3 minutes: the slab rings (bead 0.52, 12 mm/s) must
stick; if they lift, stop, clean the plate, and print again. Then the first 5 mm (the courtyard ring and the outline) — this is the
"brim pulling into shape" test. Photograph: z ≈ 3 (slab + ring), z ≈ 17 (four columns just separated), z ≈ 32 (first neck),
z ≈ 44 (clover), z ≈ 53 (courtyard closing), finish. Do not stop for a loose loop; stop only if the nozzle drags a blob.

**Route A (fallback, ~15 h):** `P0_suma_2x2.stl` in Bambu Studio, D5 profile, elephant-foot 0, XY compensation 0, no slicer brim.

After: photograph before touching; note whether the necks (z 32–46) are welded through (pull gently); then rename the folder `..._physical`
and fill `manifest.json → outcomes`.
