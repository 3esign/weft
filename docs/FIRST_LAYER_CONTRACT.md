# First-layer export contract · 2026-09-19 · G-667

The reported OBRTAJ Ender preview showed a preparation purge at Z0.30 as layer 1 and the real base at Z0.20 as layer 2. The base was present: 2,531 extrusion segments, 7,189.552 mm of deposited path. This was a preview chronology defect, not evidence of an absent physical foundation. The old support gate did not check it.

All current core exports now:

1. Refuse missing, degenerate, non-finite or raised initial model geometry. The first model group begins on the bed at the machine layer height.
2. Place the existing startup commands inside a preview-only `WIPE_START` / `WIPE_END` preparation scope. The machine instructions, purge height, extrusion and sequence are unchanged. A nested harvested wipe end cannot accidentally expose subsequent startup extrusion. Preparation is available under the preview's Wipe display category.
3. Emit a versioned first-layer declaration and the existing model `FEATURE` and layer tags. Preparation scope ends before the model.
4. Independently parse the emitted first layer before returning it. The parser accounts for absolute/relative XYZ, M82/M83 and G92. It requires actual planar XY extrusion, a real layer-0 path, matching height metadata and an unhidden model role. It rejects a differing first preview deposition height.
5. Run this check before the support gate's bed exemptions and before Bambu container packaging. The final package is checked again when extracted by the final gate. A purge cannot stand in for a model foundation.

Implementation: `core/weft_core.js` (shared Node/browser exporter), `core/weft_gate.js` (`firstLayerAudit`, support-gate integration), `core/weft_build.mjs` (packer refusal). Tests: `tests/first_layer.test.mjs` and the browser gate regression, both in `npm test`.

`FEATURE: Custom` alone is insufficient: preparation display Z may come from stale or missing initial-layer configuration. The reviewed Creality source classifies wipe moves separately from extrusion; its renderer makes model layers from extrusion moves and creates another layer even when Z decreases. Sources inspected 2026-09-19: [GCodeProcessor.cpp](https://github.com/CrealityOfficial/CrealityPrint/blob/master/src/libslic3r/GCode/GCodeProcessor.cpp) and [LegacyRenderer.cpp](https://github.com/CrealityOfficial/CrealityPrint/blob/master/src/slic3r/GUI/GCodeRenderer/LegacyRenderer.cpp). This is source inspection, not a claim that the installed GUI was reopened or tested.

Historical printed files and their receipts remain immutable. LIMIT16 parity permits only the explicitly versioned new preview comments and the resulting verified container payload MD5; other bytes remain identical. No geometry golden was regenerated.

The support classifier still performs its original physical-path analysis, including startup moves; wipe metadata does not exempt physical extrusion from that analysis. This first-layer contract is additional to it. It does not simulate firmware macros, prove adhesion, or replace observation of the first physical layer. Third-party reslicing or manual edits require revalidation of the resulting final file.

Honest verdict: the reported defect is reproduced from actual file bytes, the corrected chronology and unchanged machine commands are checked, and regressions reject empty, hidden, raised and misnumbered first layers. Native slicer UI and physical printing were not performed. These guards prevent this tested failure from being exported; they are not a claim that every possible future software defect is impossible.
