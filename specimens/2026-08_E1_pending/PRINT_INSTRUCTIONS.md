# E1 — weld rigidity fork · print instructions (Route A)

STATUS: generated, NOT yet printed. Bead in this STL = 0.45 mm (placeholder).

1. CALIBRATE FIRST: on the A2L (0.4 nozzle), find the exact width Bambu Studio /
   Arachne accepts as ONE continuous bead (thin-wall test). If it differs from
   0.45 by more than ~0.03 mm: open index.html → Batch mode → grid 4,
   sweep X = overshoot, sweep Y = web type, set the measured bead → Download STL,
   and replace the file here. Update "bead_mm" in manifest.json.
2. Bambu Studio: open STL → wall loops 1, no top/bottom layers, no infill,
   layer 0.24 → slice → PREVIEW must show single continuous lines per wall.
3. Print PLA, ~215 °C / bed 55 °C. ~2.5–3 h.
4. BEFORE touching anything: photograph the whole plate + each specimen,
   fixed tripod position. Fiducial bar marks the row0/col0 corner.
   Rows away from fiducial: diagonal, perp, staple, sine. Columns: e = 0, 0.6, 1.2, 1.8.
5. Fill "outcomes" per specimen in manifest.json:
   survived_removal · torsion_feel (twist by hand; compare rows) ·
   failure_mode on deliberate breaks: "cohesive" (member snaps) vs
   "adhesive" (member peels off chord) · notes.
6. Rename this folder: replace "_pending" with the print date.
