# Specimen knowledge base

One folder per print job: `specimens/YYYY-MM-DD_shortname/` containing:

- `manifest.json` — the settings vector (schema below)
- `photos/` — fixed-rig photos, repeatable angles (tripod + turntable marks)
- `outcomes.md` — measured results per specimen
- `membrane_process_status.json` — when caps exist, the current machine-readable
  `qualified | experimental | failed` decision for the exact process/version/span

## manifest.json schema (per specimen / grid cell)

```json
{
  "date": "", "printer": "Bambu A2L", "nozzle_mm": 0.4, "material": "PLA",
  "grid": {"row": 0, "col": 0},
  "params": {
    "bead_mm": 0.45, "layer_mm": 0.24, "wall_span_mm": 5, "lambda_mm": 8,
    "web_type": "staple", "overhang_e_mm": 1.0, "dwell_mm": 0.6,
    "jitter": 0, "jitter_seed": 1337, "flow_boost": 1.25,
    "speed_mms": 30, "bridge_speed_mms": 18, "nozzle_C": 215, "bed_C": 55,
    "route": "A-stl | B-gcode"
  },
  "outcomes": {
    "survived_removal": null, "torsion_feel": "stiff|soft|failed",
    "failure_mode": "cohesive|adhesive|none", "bridge_sag_mm": null,
    "notes": ""
  }
}
```

Rules: never overwrite a manifest after printing; photograph before handling;
record the seed whenever jitter is nonzero. A manifest preserves what was believed
when the artifact was emitted. After plastic exists, `outcomes.md` and
`membrane_process_status.json` are the current decision surface and may withdraw
an older ready-to-print claim without rewriting that historical receipt.

## Latest builds (unprinted)

OBLAK (A2L) and GORA (Ender-3 V4), 2026-09-05: `SCULPTURES_2026-09-05.md`, folders `2026-09-05_*_X1_experimental/`. Folder suffixes: `_physical` = printed, `_pending` = built and waiting, `_experimental` = declared over the evidence.

## Latest physical result

The paired A2L / Ender-3 V4 LIMIT16 run from 2026-09-04 is consolidated in
[LIMIT16_2026-09-04_RESULTS.md](LIMIT16_2026-09-04_RESULTS.md). Its exact
single-layer inward-spiral membrane process failed on both machines; that
versioned process identity is now blocked from future builds.

## 2026-09-19 ? X2 ziggurat physical-status update

[Creality X2 outcome and photographs](2026-09-18_ZIGURAT2_VRTLOG_ENDER3V4_X2_experimental/outcomes.md) ? [A2L X2 last reported status](2026-09-18_ZIGURAT2_TKANJE_A2L_X2_experimental/outcomes.md) ? [WEFT/paper continuation](../../paper/03_experiments/2026-09-19_zigurat_horizontal_weft/README.md). Build-time NOT PRINTED labels in the original receipts are historical.
