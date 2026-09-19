# RAZMAK_A2L_H4 — reproducible build

Run from the WEFT repository. Uses installed Node and the existing WEFT core; no added dependencies. Preview rendering uses the already-installed Playwright and local Three.js.

```powershell
node core/weft_suspended_steps_geometry.mjs --machine a2l --out specimens/2026-09-19_RAZMAK_A2L_H4_experimental/RAZMAK_A2L_H4_geometry.json
node tools/inspect_suspended_steps.mjs specimens/2026-09-19_RAZMAK_A2L_H4_experimental/RAZMAK_A2L_H4_geometry.json
node tools/preview_suspended_steps.mjs specimens/2026-09-19_RAZMAK_A2L_H4_experimental/preview-paths.json
node tools/build_suspended_steps.mjs specimens/2026-09-19_RAZMAK_A2L_H4_experimental/RAZMAK_A2L_H4_geometry.json
node tools/export_suspended_steps_stl.mjs specimens/2026-09-19_RAZMAK_A2L_H4_experimental/RAZMAK_A2L_H4_geometry.json
node tools/audit_suspended_roof.mjs specimens/2026-09-19_RAZMAK_A2L_H4_experimental/RAZMAK_A2L_H4_geometry.json
node tools/audit_suspended_steps.mjs specimens/2026-09-19_RAZMAK_A2L_H4_experimental/RAZMAK_A2L_H4_geometry.json
npm test
```

Use a new output folder for any later revision; do not overwrite a frozen delivery receipt. `probe_suspended_steps.mjs` is a non-printing local diagnostic and cannot substitute for full-height final G-code checks. Preserve reported dense-roof overlap contacts. The 180 mm ceiling is an explicit experiment admission; every complete 16.2 mm finding must remain within a declared zone.

Regression state: new crossing, end-Z, streamed-STL and exhaustive-report checks are in `npm test`. The historical legacy suite was already 49/61 before this work; see the saved post-change test log. Python parity requires an unavailable Python/numpy/scipy environment and is reported as skipped, not passed.

Physical recording: follow PREDICTIONS.md. Keep the exact print filename/hash, settings and time history, photograph the terrace before/after each new wall, preserve a failure or interruption, and update outcomes.md plus the project specimen ledger when evidence arrives.

Honest verdict: this protocol reproduces digital artifacts. It neither launches a printer nor claims a successful physical specimen.